import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionContext, generatedMissions, parseMissionDrafts, type MissionContext, type MissionDraft } from '../../src/domain/missionGeneration';
import { checkMissionMatch, freshMissions } from '../../src/domain/missions';
import { parseItem } from '../../src/domain/validation';
import { validateDaily } from '../../src/repository/records';
import { AppError } from '../../src/repository/LibraryRepository';
import { createMissionGenerationUsecases } from '../../src/usecases/missionGeneration';
import { createLibraryUsecases } from '../../src/usecases/createLibraryUsecases';
import { InMemoryLibraryRepository } from '../helpers/InMemoryLibraryRepository';

const word = (name: string) => ({ ...parseItem({ word: name, chinese: '物件' })!, savedAt: 1 });
const draft = (targetWord: string, kind: MissionDraft['kind'] = 'new'): MissionDraft => ({ targetWord, targetChinese: '物件',
  phonetic: '/test/', partOfSpeech: '名詞', emoji: '📷', hint: '在生活中找找這個物件', synonyms: [targetWord], kind, reason: '常見的生活物件' });
const suggestions = () => [draft('cup', 'review'), draft('umbrella'), draft('scarf')];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function setup(timeoutMs = 25000) {
  let now = new Date('2026-10-27T12:00:00').getTime(); let id = 0;
  const deps = { now: () => now, createId: () => `operation-${++id}`, timeZone: () => 'Asia/Taipei', timeoutMs };
  const repo = new InMemoryLibraryRepository();
  repo.state = { revision: 0, initialized: true, words: [word('cup')], daily: freshMissions('2026-10-27') };
  return { repo, deps, library: createLibraryUsecases(repo, deps), setNow(value: string) { now = new Date(value).getTime(); } };
}
test('mission context prioritizes weak/unreviewed words and excludes images, credentials and unrelated fields', () => {
  const words = [
    { ...word('book'), reviewCount: 10, rememberedCount: 10, masteryScore: 100, lastReviewedAt: 10, photo: { kind: 'asset' as const, path: '/private.jpg' } },
    { ...word('cup'), reviewCount: 5, rememberedCount: 1, masteryScore: 20, lastReviewedAt: 2 }, word('plant'),
  ];
  const context = createMissionContext(words, '2026-10-27', 'Asia/Taipei');
  assert.deepEqual(context.reviewCandidates.map(w => w.word), ['plant', 'cup', 'book']);
  assert.equal(context.month, 10); assert.equal(context.timeZone, 'Asia/Taipei');
  assert(!JSON.stringify(context).includes('/private.jpg')); assert(!JSON.stringify(context).includes('exampleEn'));
  const many = createMissionContext(Array.from({ length: 1000 }, (_, i) => word(`object ${i}`)), context.dateKey, context.timeZone);
  assert.equal(many.knownWords.length, 500); assert.equal(many.reviewCandidates.length, 30);
});
test('generated missions require exactly three distinct objects, reasons, one real review and two unknown words', () => {
  const known = [word('cup')]; const context = createMissionContext(known, '2026-10-27', 'Asia/Taipei');
  const valid = generatedMissions(suggestions(), context.dateKey, known, context)!;
  assert.equal(valid.length, 3); assert(valid.every(m => m.id.startsWith('2026-10-27_ai') && !m.isCompleted));
  assert.equal(generatedMissions([draft('cup'), draft('umbrella'), draft('scarf')], context.dateKey, known, context), null);
  assert.equal(generatedMissions([draft('book', 'review'), draft('umbrella'), draft('scarf')], context.dateKey, known, context), null);
  assert.equal(generatedMissions([draft('cup', 'review'), draft('cup'), draft('scarf')], context.dateKey, known, context), null);
  assert.equal(parseMissionDrafts({ missions: suggestions().slice(0, 2) }), null);
  assert.equal(parseMissionDrafts({ missions: [draft('cup'), { ...draft('umbrella'), synonyms: [' CUP '] }, draft('scarf')] }), null);
  assert.equal(parseMissionDrafts({ missions: [{ ...draft('cup'), reason: '' }, draft('umbrella'), draft('scarf')] }), null);
  const empty = createMissionContext([], context.dateKey, context.timeZone);
  assert(generatedMissions([draft('cup'), draft('umbrella'), draft('scarf')], context.dateKey, [], empty));
  assert.equal(checkMissionMatch({ ...valid[0], synonyms: ['mug'] }, [parseItem({ word: 'coffee', chinese: '咖啡' })!]), null);
});
test('AI result is persisted once per day; conflict retries and reloads do not repeat generation', async () => {
  const { repo, deps } = setup(); let calls = 0; let input: MissionContext | undefined;
  const provider = { generate: async (context: MissionContext) => { calls++; input = context; repo.conflicts = 2; return suggestions(); } };
  const usecases = createMissionGenerationUsecases(repo, provider, deps);
  const first = await usecases.ensure();
  assert.equal(first.daily.generation?.status, 'ready');
  assert.equal(first.daily.generation?.status === 'ready' && first.daily.generation.source, 'ai');
  assert.equal(input?.reviewCandidates[0].word, 'cup');
  await usecases.ensure(); await createMissionGenerationUsecases(repo, provider, deps).ensure();
  assert.equal(calls, 1); assert.equal(repo.state.daily.missions[0].targetWord, 'cup');
});
test('simultaneous calls and two services share a durable claim before calling AI', async () => {
  const { repo, deps } = setup(); const waiting = deferred<MissionDraft[]>(); const started = deferred<void>(); let calls = 0;
  const provider = { generate: async () => { calls++; started.resolve(); return waiting.promise; } };
  const a = createMissionGenerationUsecases(repo, provider, deps); const b = createMissionGenerationUsecases(repo, provider, deps);
  const first = a.ensure(); assert.equal(a.ensure(), first);
  await started.promise; const second = await b.ensure();
  assert.equal(second.daily.generation?.status, 'generating'); assert.equal(calls, 1);
  waiting.resolve(suggestions()); await first;
  assert.equal(repo.state.daily.generation?.status === 'ready' && repo.state.daily.generation.source, 'ai');
});
test('no key, provider errors and malformed output settle once to stable fallback', async () => {
  for (const outcome of ['MissingCredential', 'RateLimited', 'InvalidResponse', 'bad-output'] as const) {
    const { repo, deps } = setup(); const before = structuredClone(repo.state.daily.missions); let calls = 0;
    const usecases = createMissionGenerationUsecases(repo, { generate: async () => {
      calls++; if (outcome === 'bad-output') return [];
      throw new AppError(outcome);
    } }, deps);
    await usecases.ensure(); await usecases.ensure();
    assert.equal(calls, 1); assert.deepEqual(repo.state.daily.missions, before);
    const state = repo.state.daily.generation;
    assert(state?.status === 'ready' && state.source === 'fallback');
    assert.equal(state.fallbackReason, outcome === 'MissingCredential' ? 'missing-key' : 'generation-failed');
  }
});
test('timeout bounds a provider that ignores cancellation and late results cannot replace fallback', async () => {
  const { repo, deps } = setup(10); const waiting = deferred<MissionDraft[]>();
  await createMissionGenerationUsecases(repo, { generate: () => waiting.promise }, deps).ensure();
  const before = structuredClone(repo.state.daily);
  waiting.resolve(suggestions()); await Promise.resolve();
  assert.deepEqual(repo.state.daily, before);
  assert(before.generation?.status === 'ready' && before.generation.source === 'fallback');
});
test('closing aborts generation; an abandoned claim later recovers without another AI request', async () => {
  const { repo, deps, setNow } = setup(); const started = deferred<void>(); let signal: AbortSignal | undefined; let calls = 0;
  const provider = { generate: async (_: MissionContext, options: { signal: AbortSignal }) => {
    calls++; signal = options.signal; started.resolve(); return new Promise<MissionDraft[]>(() => {});
  } };
  const usecases = createMissionGenerationUsecases(repo, provider, deps); const pending = usecases.ensure();
  await started.promise; usecases.close(); await pending; assert(signal?.aborted);
  setNow('2026-10-27T12:00:31');
  await createMissionGenerationUsecases(repo, provider, deps).ensure();
  assert.equal(calls, 1);
  assert(repo.state.daily.generation?.status === 'ready' && repo.state.daily.generation.fallbackReason === 'interrupted');
});
test('a started mission and legacy completed progress never get replaced by AI', async () => {
  const { repo, deps, library } = setup(); let calls = 0;
  const usecases = createMissionGenerationUsecases(repo, { generate: async () => { calls++; return suggestions(); } }, deps);
  await library.startMission(repo.state.daily.missions[0].id); const before = structuredClone(repo.state.daily);
  await usecases.ensure(); assert.equal(calls, 0); assert.deepEqual(repo.state.daily, before);
  delete repo.state.daily.generation; repo.state.daily.missions[0].isCompleted = true;
  await usecases.ensure(); assert.equal(calls, 0); assert(repo.state.daily.missions[0].isCompleted);
});
test('a mission started while AI is pending wins over the late generated result', async () => {
  const { repo, deps, library } = setup(); const waiting = deferred<MissionDraft[]>(); const started = deferred<void>();
  const pending = createMissionGenerationUsecases(repo, { generate: async () => { started.resolve(); return waiting.promise; } }, deps).ensure();
  await started.promise;
  await library.startMission(repo.state.daily.missions[0].id);
  const before = structuredClone(repo.state.daily);
  waiting.resolve(suggestions()); await pending;
  assert.deepEqual(repo.state.daily, before);
});
test('midnight discards an old AI result and the next day gets its own generation', async () => {
  const { repo, deps, library, setNow } = setup(); const waiting = deferred<MissionDraft[]>(); const started = deferred<void>(); let calls = 0;
  const usecases = createMissionGenerationUsecases(repo, { generate: async () => { calls++; if (calls === 1) { started.resolve(); return waiting.promise; } return suggestions(); } }, deps);
  const pending = usecases.ensure(); await started.promise;
  setNow('2026-10-28T00:00:01'); await library.ensureMissionDay();
  waiting.resolve(suggestions()); await pending;
  assert.equal(repo.state.daily.dateKey, '2026-10-28'); assert.equal(repo.state.daily.generation?.status, 'pending');
  await usecases.ensure(); assert.equal(calls, 2);
  assert(repo.state.daily.missions.every(m => m.id.startsWith('2026-10-28_ai')));
});
test('a newly saved word while generating cannot become a new-word mission', async () => {
  const { repo, deps, library } = setup(); const waiting = deferred<MissionDraft[]>(); const started = deferred<void>();
  const pending = createMissionGenerationUsecases(repo, { generate: async () => { started.resolve(); return waiting.promise; } }, deps).ensure();
  await started.promise; await library.saveWord(word('umbrella'));
  waiting.resolve(suggestions()); await pending;
  assert(repo.state.daily.generation?.status === 'ready' && repo.state.daily.generation.source === 'fallback');
});
test('generation metadata is validated while old records remain readable', () => {
  const daily = freshMissions('2026-10-27'); delete daily.generation; validateDaily(daily);
  for (const generation of [{ status: 'generating', requestId: 'id', startedAt: NaN }, { status: 'ready', source: 'other', generatedAt: 1 }, { status: 'ready', source: 'ai', generatedAt: -1 }]) {
    assert.throws(() => validateDaily({ ...daily, generation }), (cause: AppError) => cause.code === 'InvalidData');
  }
});
