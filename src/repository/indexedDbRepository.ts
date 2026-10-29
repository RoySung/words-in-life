import type { MissionState } from '../domain/missions';
import { freshMissions } from '../domain/missions';
import type { Word } from '../domain/vocabulary';
import { photoRefs } from '../domain/photos';
import { record } from '../domain/validation';
import { AppError, type CommitRequest, type CommitResult, type LibraryRepository, type LibrarySnapshot, type OperationResult, type PhotoContent } from './LibraryRepository';
import { completed, DATABASE_NAME, openDatabase, request } from './database';
import { validateDaily, validateWord } from './records';

interface Meta { revision: number; initialized: boolean }
interface PhotoMetadata { mimeType: string; size: number; references: number }
interface Receipt { revision: number; result: OperationResult }
const dailyRefs = (daily?: MissionState) => daily?.missions.flatMap(m => photoRefs({ photo: m.completedPhoto, crop: m.completedCrop })) || [];
function storageError(cause: unknown): AppError {
  if (cause instanceof AppError) return cause;
  const name = cause instanceof Error ? cause.name : '';
  return new AppError(name === 'QuotaExceededError' ? 'QuotaExceeded' : name === 'InvalidStateError' || name === 'SecurityError' ? 'Unavailable' : 'Unexpected', undefined, { cause });
}

/** All writers share the meta store; revision is checked inside the actual IDB transaction. */
export class IndexedDbLibraryRepository implements LibraryRepository {
  private database?: Promise<IDBDatabase>;
  private channel?: BroadcastChannel;
  private listeners = new Set<(revision: number) => void>();
  private closed = false;
  constructor(private factory: IDBFactory = indexedDB, private name = DATABASE_NAME) {}
  private async open() {
    if (this.closed) throw new AppError('Unavailable');
    if (!this.database) {
      this.database = openDatabase(this.factory, this.name).then(db => {
        if (this.closed) { db.close(); throw new AppError('Unavailable'); }
        db.onversionchange = () => this.close();
        if (typeof BroadcastChannel !== 'undefined') {
          this.channel = new BroadcastChannel(`${this.name}:changes`);
          this.channel.onmessage = event => { if (Number.isInteger(event.data?.revision)) this.notify(event.data.revision); };
        }
        return db;
      }).catch(cause => { this.database = undefined; throw storageError(cause); });
    }
    return this.database;
  }
  private notify(revision: number) { this.listeners.forEach(listener => { try { listener(revision); } catch { /* a subscriber cannot undo a commit */ } }); }
  subscribe(listener: (revision: number) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  async read(): Promise<LibrarySnapshot> {
    try {
      const db = await this.open();
      const tx = db.transaction(['words', 'learning', 'meta']);
      const done = completed(tx);
      const [words, storedDaily, storedMeta] = await Promise.all([
        request(tx.objectStore('words').getAll()), request(tx.objectStore('learning').get('current')), request(tx.objectStore('meta').get('state')), done,
      ]);
      const meta: Meta = storedMeta ?? { revision: 0, initialized: false };
      if (!Number.isInteger(meta.revision) || meta.revision < 0 || typeof meta.initialized !== 'boolean') throw new AppError('InvalidData');
      words.forEach(validateWord);
      const daily = storedDaily ?? freshMissions(); validateDaily(daily);
      return { ...meta, words: (words as Word[]).sort((a, b) => b.savedAt - a.savedAt), daily };
    } catch (cause) { throw storageError(cause); }
  }
  async commit(command: CommitRequest): Promise<CommitResult> {
    const db = await this.open();
    const changingWords = !!(command.changes.putWords?.length || command.changes.removeWords?.length);
    const scopes = ['meta', 'operations', ...(changingWords ? ['words'] : []), ...(command.changes.daily ? ['learning'] : []),
      ...(changingWords || command.changes.daily ? ['photos', 'photoMetadata'] : [])];
    const tx = db.transaction(scopes, 'readwrite');
    const done = completed(tx);
    let revision = 0;
    try {
      const [meta, receipt] = await Promise.all([
        request(tx.objectStore('meta').get('state')) as Promise<Meta | undefined>,
        request(tx.objectStore('operations').get(command.commandId)) as Promise<Receipt | undefined>,
      ]);
      if (receipt) { await done; return { kind: 'alreadyApplied', ...receipt }; }
      if ((meta?.revision ?? 0) !== command.expectedRevision) { await done; return { kind: 'conflict' }; }
      if (!command.commandId || !Number.isInteger(command.expectedRevision)) throw new AppError('InvalidData');
      const deltas = new Map<string, number>();
      const adjust = (ids: string[], sign: number) => ids.forEach(id => deltas.set(id, (deltas.get(id) || 0) + sign));
      const puts = command.changes.putWords || [];
      puts.forEach(validateWord);
      const removes = command.changes.removeWords || [];
      const keys = [...new Set([...puts.map(w => w.id), ...removes])];
      if (keys.length) {
        const previous = await Promise.all(keys.map(key => request(tx.objectStore('words').get(key)) as Promise<Word | undefined>));
        previous.forEach(word => { if (word) { validateWord(word); adjust(photoRefs(word), -1); } });
        puts.forEach(word => adjust(photoRefs(word), 1));
      }
      if (command.changes.daily) {
        validateDaily(command.changes.daily);
        const previous = await request(tx.objectStore('learning').get('current')) as MissionState | undefined;
        if (previous) validateDaily(previous);
        adjust(dailyRefs(previous), -1); adjust(dailyRefs(command.changes.daily), 1);
      }
      const changedPhotos = [...deltas].filter(([, delta]) => delta !== 0);
      const oldMetadata = await Promise.all(changedPhotos.map(([id]) => request(tx.objectStore('photoMetadata').get(id)) as Promise<PhotoMetadata | undefined>));
      const prepared = new Map(command.photos.map(photo => [photo.id, photo]));
      changedPhotos.forEach(([id, delta], i) => {
        const old = oldMetadata[i];
        const references = (old?.references || 0) + delta;
        if (references < 0) throw new AppError('InvalidData');
        if (references === 0) { tx.objectStore('photos').delete(id); tx.objectStore('photoMetadata').delete(id); return; }
        if (!old) {
          const photo = prepared.get(id);
          if (!photo || !photo.mimeType.startsWith('image/')) throw new AppError('InvalidData');
          tx.objectStore('photos').put(new Blob([photo.bytes.slice().buffer], { type: photo.mimeType }), id);
          tx.objectStore('photoMetadata').put({ mimeType: photo.mimeType, size: photo.bytes.byteLength, references }, id);
        } else tx.objectStore('photoMetadata').put({ ...old, references }, id);
      });
      if (changingWords) {
        removes.forEach(id => tx.objectStore('words').delete(id));
        puts.forEach(word => tx.objectStore('words').put(word, word.id));
      }
      if (command.changes.daily) tx.objectStore('learning').put(command.changes.daily, 'current');
      revision = (meta?.revision || 0) + 1;
      tx.objectStore('operations').put({ revision, result: command.result } satisfies Receipt, command.commandId);
      tx.objectStore('meta').put({ revision, initialized: !!(meta?.initialized || command.changes.initialize) } satisfies Meta, 'state');
      await done;
    } catch (cause) {
      try { tx.abort(); } catch { /* already finished */ }
      await done.catch(() => {});
      throw storageError(cause);
    }
    this.notify(revision);
    try { this.channel?.postMessage({ revision }); } catch { /* commit is already durable */ }
    return { kind: 'committed', revision, result: command.result };
  }
  async readPhoto(id: string): Promise<PhotoContent> {
    try {
      const db = await this.open();
      const tx = db.transaction(['photos', 'photoMetadata']);
      const [blob, metadata] = await Promise.all([request(tx.objectStore('photos').get(id)), request(tx.objectStore('photoMetadata').get(id)), completed(tx)]);
      if (!(blob instanceof Blob) || !record(metadata) || typeof metadata.mimeType !== 'string') throw new AppError('InvalidData');
      return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: metadata.mimeType };
    } catch (cause) { throw storageError(cause); }
  }
  close() { this.closed = true; void this.database?.then(db => db.close()).catch(() => {}); this.channel?.close(); this.listeners.clear(); }
}
