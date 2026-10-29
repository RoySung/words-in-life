import { freshMissions } from '../../src/domain/missions';
import { photoRefs } from '../../src/domain/photos';
import { AppError, type CommitRequest, type CommitResult, type LibraryRepository, type LibrarySnapshot, type OperationResult, type PhotoContent } from '../../src/repository/LibraryRepository';

export class InMemoryLibraryRepository implements LibraryRepository {
  state: LibrarySnapshot = { revision: 0, initialized: false, words: [], daily: freshMissions() };
  operations = new Map<string, { revision: number; result: OperationResult }>();
  photos = new Map<string, PhotoContent>();
  listeners = new Set<(revision: number) => void>();
  conflicts = 0;
  commits = 0;
  async read() { return structuredClone(this.state); }
  async commit(input: CommitRequest): Promise<CommitResult> {
    const receipt = this.operations.get(input.commandId);
    if (receipt) return { kind: 'alreadyApplied', ...structuredClone(receipt) };
    if (this.conflicts-- > 0 || input.expectedRevision !== this.state.revision) return { kind: 'conflict' };
    const next = structuredClone(this.state);
    for (const id of input.changes.removeWords || []) next.words = next.words.filter(word => word.id !== id);
    for (const word of input.changes.putWords || []) next.words = [...next.words.filter(w => w.id !== word.id), structuredClone(word)];
    if (input.changes.daily) next.daily = structuredClone(input.changes.daily);
    if (input.changes.initialize) next.initialized = true;
    const needed = new Set([...next.words.flatMap(photoRefs), ...next.daily.missions.flatMap(m => photoRefs({ photo: m.completedPhoto, crop: m.completedCrop }))]);
    const photos = new Map(this.photos);
    for (const id of needed) {
      if (!photos.has(id)) {
        const photo = input.photos.find(p => p.id === id);
        if (!photo) throw new AppError('InvalidData');
        photos.set(id, structuredClone(photo));
      }
    }
    for (const id of photos.keys()) if (!needed.has(id)) photos.delete(id);
    next.revision++;
    const result = { revision: next.revision, result: structuredClone(input.result) };
    this.state = next; this.photos = photos; this.commits++;
    this.operations.set(input.commandId, result); this.listeners.forEach(l => l(next.revision));
    return { kind: 'committed', ...result };
  }
  async readPhoto(id: string) { const photo = this.photos.get(id); if (!photo) throw new AppError('InvalidData'); return structuredClone(photo); }
  subscribe(listener: (revision: number) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  close() { this.listeners.clear(); }
}
