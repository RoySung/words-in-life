import type { LibraryRepository, PreparedPhoto } from '../../src/repository/LibraryRepository';
import { createLibraryUsecases } from '../../src/usecases/createLibraryUsecases';
import { parseItem } from '../../src/domain/validation';
export async function libraryContract(repo: LibraryRepository) {
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  let id = 0;
  const usecases = createLibraryUsecases(repo, { now: () => new Date('2026-10-27T12:00:00').getTime(), createId: () => `contract-${++id}` });
  const photo: PreparedPhoto = { id: 'photo:contract', bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' };
  const word = { ...parseItem({ word: 'cup', chinese: '杯子' })!, savedAt: 1, photo: { kind: 'stored' as const, photoId: photo.id }, crop: { kind: 'stored' as const, photoId: photo.id } };
  await usecases.initialize(async () => ({ words: [], photos: [] }));
  await usecases.saveWord(word, [photo]);
  await usecases.saveWord(word, []);
  check((await repo.read()).words.length === 1, 'duplicate save');
  await usecases.recordReview(word.id, true, 'review-once');
  await usecases.recordReview(word.id, true, 'review-once');
  check((await repo.read()).words[0].reviewCount === 1, 'duplicate review');
  const current = await repo.read();
  const conflict = await repo.commit({ commandId: 'stale', expectedRevision: current.revision - 1, changes: {}, photos: [], result: { kind: 'day' } });
  check(conflict.kind === 'conflict', 'stale revision');
  check((await repo.readPhoto(photo.id)).bytes.length === 3, 'photo content');
  await usecases.removeWord(word.id);
  await usecases.removeWord(word.id);
  check((await repo.read()).words.length === 0, 'remove is idempotent');
  let missing = false;
  try { await usecases.recordReview(word.id, false); } catch (e) { missing = (e as { code: string }).code === 'NotFound'; }
  check(missing, 'review must not resurrect removed word');
  await usecases.initialize(async () => ({ words: [word], photos: [photo] }));
  check((await repo.read()).words.length === 0, 'empty initialized collection stays empty');
  let deleted = false;
  try { await repo.readPhoto(photo.id); } catch { deleted = true; }
  check(deleted, 'last photo reference is removed');
  return true;
}
