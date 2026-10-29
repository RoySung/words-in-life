import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryLibraryRepository } from '../helpers/InMemoryLibraryRepository';
import { libraryContract } from '../helpers/libraryContract';
import { createLibraryUsecases } from '../../src/usecases/createLibraryUsecases';
import { createRecognitionUsecases } from '../../src/usecases/recognition';
import { parseItem } from '../../src/domain/validation';
import { AppError } from '../../src/repository/LibraryRepository';
import type { RecognitionRepository } from '../../src/repository/RecognitionRepository';

const item = parseItem({ word: 'cup', chinese: '杯子' })!;
const deps = { now: () => new Date('2026-10-27T12:00:00').getTime(), createId: (() => { let n = 0; return () => `id-${++n}`; })() };
test('memory repository follows the shared contract', async () => { await libraryContract(new InMemoryLibraryRepository()); });
test('conflicts reapply changes to latest data and stop after three attempts', async () => {
  const repo = new InMemoryLibraryRepository(); const uc = createLibraryUsecases(repo, deps);
  await uc.initialize(async () => ({ words: [], photos: [] }));
  repo.conflicts = 2; await uc.saveWord({ ...item, savedAt: 1 });
  assert.equal(repo.state.words.length, 1);
  repo.conflicts = 3;
  await assert.rejects(uc.removeWord(item.id), (e: AppError) => e.code === 'Conflict');
  assert.equal(repo.state.words.length, 1);
});
test('same analysis cannot complete another mission after a successful commit', async () => {
  const repo = new InMemoryLibraryRepository(); const uc = createLibraryUsecases(repo, deps);
  await uc.initialize(async () => ({ words: [], photos: [] }));
  const items = repo.state.daily.missions.map(m => parseItem({ word: m.targetWord, chinese: m.targetChinese })!);
  await uc.completeMission({ items, analysisId: 'one' });
  await uc.completeMission({ items, analysisId: 'one' });
  assert.equal(repo.state.daily.missions.filter(m => m.isCompleted).length, 1);
});
const media = { compress: async () => ({ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }), crop: async (_: string, items: typeof item[]) => items };
const recognized = { success: true as const, data: { sceneTitle: '場景', sceneDescription: '描述', items: [item] } };
test('recognition and samples work without SDK dependencies; samples never call provider', async () => {
  let calls = 0;
  const provider: RecognitionRepository = { analyze: async () => { calls++; return recognized; } };
  const uc = createRecognitionUsecases(provider, media, deps);
  const result = await uc.recognizePhoto('source', new AbortController().signal); assert(result.success);
  await uc.prepareSampleScene('sample', recognized.data, new AbortController().signal);
  assert.equal(calls, 1);
});
test('recognition timeout includes a stalled provider, and user cancellation is distinct', async () => {
  const provider: RecognitionRepository = { analyze: () => new Promise(() => {}) };
  const uc = createRecognitionUsecases(provider, media, { ...deps, timeoutMs: 20 });
  await assert.rejects(uc.recognizePhoto('source', new AbortController().signal), (e: AppError) => e.code === 'Timeout');
  const abort = new AbortController(); const pending = uc.recognizePhoto('source', abort.signal); abort.abort();
  await assert.rejects(pending, (e: AppError) => e.code === 'Cancelled');
});
test('invalid provider data is rejected before cropping; unrecognizable is an ordinary result', async () => {
  const uc = createRecognitionUsecases({ analyze: async () => ({ ...recognized, data: { ...recognized.data, items: [{ ...item, word: 42 as unknown as string }] } }) }, media, deps);
  await assert.rejects(uc.recognizePhoto('source', new AbortController().signal), (e: AppError) => e.code === 'InvalidResponse');
  const failure = { success: false as const, reasonCode: 'NO_ITEMS_FOUND' as const, title: '無物品', description: '描述', suggestions: [] };
  const noObjects = createRecognitionUsecases({ analyze: async () => failure }, media, deps);
  assert.deepEqual(await noObjects.recognizePhoto('source', new AbortController().signal), failure);
});
test('database conflicts after recognition never repeat the provider call', async () => {
  let calls = 0;
  const recognize = createRecognitionUsecases({ analyze: async () => { calls++; return recognized; } }, media, deps);
  const result = await recognize.recognizePhoto('source', new AbortController().signal); assert(result.success);
  const repo = new InMemoryLibraryRepository(); const uc = createLibraryUsecases(repo, deps);
  await uc.initialize(async () => ({ words: [], photos: [] })); repo.conflicts = 2;
  await uc.completeMission({ items: result.scene.items, analysisId: result.scene.analysisId });
  assert.equal(calls, 1);
});
