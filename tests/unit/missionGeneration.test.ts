import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionContext, generatedMissions, parseMissionDrafts, type MissionContext, type MissionDraft } from '../../src/domain/missionGeneration';
import { checkMissionMatch, freshMissions, generateDailyMissionsForDate, rollDate, missionNames } from '../../src/domain/missions';
import { parseItem } from '../../src/domain/validation';
import { validateDaily } from '../../src/repository/records';
import { AppError } from '../../src/repository/LibraryRepository';
import { createMissionGenerationUsecases } from '../../src/usecases/missionGeneration';
import { createLibraryUsecases } from '../../src/usecases/createLibraryUsecases';
import { InMemoryLibraryRepository } from '../helpers/InMemoryLibraryRepository';

const word = (name: string) => ({ ...parseItem({ word: name, chinese: '物件' })!, savedAt: 1 });
const draft = (targetWord: string, kind: MissionDraft['kind'] = 'new'): MissionDraft => ({ targetWord, targetChinese: '物件',
  phonetic: '/test/', partOfSpeech: '名詞', emoji: '📷', hint: '在生活中找找這個物件', synonyms: [targetWord], kind, reason: '常見的生活物件' });
const suggestions = () => [draft('bottle'), draft('umbrella'), draft('scarf')];
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
test('mission context sends known words without review candidates and excludes images, credentials and unrelated fields', () => {
  const words = [
    { ...word('book'), reviewCount: 10, rememberedCount: 10, masteryScore: 100, lastReviewedAt: 10, photo: { kind: 'asset' as const, path: '/private.jpg' } },
    { ...word('cup'), reviewCount: 5, rememberedCount: 1, masteryScore: 20, lastReviewedAt: 2 }, word('plant'),
  ];
  const context = createMissionContext(words, '2026-10-27', 'Asia/Taipei');
  assert.deepEqual(context.reviewCandidates, []);
  assert.equal(context.month, 10); assert.equal(context.timeZone, 'Asia/Taipei');
  assert(!JSON.stringify(context).includes('/private.jpg')); assert(!JSON.stringify(context).includes('exampleEn'));
  const many = createMissionContext(Array.from({ length: 1000 }, (_, i) => word(`object ${i}`)), context.dateKey, context.timeZone);
  assert.equal(many.knownWords.length, 500); assert.equal(many.reviewCandidates.length, 0);
});
test('generated missions require exactly three distinct objects, reasons, three unknown words and no review', () => {
  const known = [word('cup')]; const context = createMissionContext(known, '2026-10-27', 'Asia/Taipei');
  const valid = generatedMissions(suggestions(), context.dateKey, known)!;
  assert.equal(valid.length, 3); assert(valid.every(m => m.id.startsWith('2026-10-27_ai') && !m.isCompleted));
  assert.equal(generatedMissions([draft('cup'), draft('umbrella'), draft('scarf')], context.dateKey, known), null);
  assert.equal(generatedMissions([draft('book', 'review'), draft('umbrella'), draft('scarf')], context.dateKey, known), null);
  assert.equal(generatedMissions([draft('cup', 'review'), draft('cup'), draft('scarf')], context.dateKey, known), null);
  assert.equal(parseMissionDrafts({ missions: suggestions().slice(0, 2) }), null);
  assert.equal(parseMissionDrafts({ missions: [draft('cup'), { ...draft('umbrella'), synonyms: [' CUP '] }, draft('scarf')] }), null);
  assert.equal(parseMissionDrafts({ missions: [{ ...draft('cup'), reason: '' }, draft('umbrella'), draft('scarf')] }), null);
  assert(generatedMissions([draft('cup'), draft('umbrella'), draft('scarf')], context.dateKey, []));
  assert.equal(checkMissionMatch({ ...valid[0], synonyms: ['mug'] }, [parseItem({ word: 'coffee', chinese: '咖啡' })!]), null);
});
test('AI result is persisted once per day; conflict retries and reloads do not repeat generation', async () => {
  const { repo, deps } = setup(); let calls = 0; let input: MissionContext | undefined;
  const provider = { generate: async (context: MissionContext) => { calls++; input = context; repo.conflicts = 2; return suggestions(); } };
  const usecases = createMissionGenerationUsecases(repo, provider, deps);
  const first = await usecases.ensure();
  assert.equal(first.daily.generation?.status, 'ready');
  assert.equal(first.daily.generation?.status === 'ready' && first.daily.generation.source, 'ai');
  assert.equal(input?.knownWords[0], 'cup');
  await usecases.ensure(); await createMissionGenerationUsecases(repo, provider, deps).ensure();
  assert.equal(calls, 1); assert.equal(repo.state.daily.missions[0].targetWord, 'bottle');
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
    const { repo, deps } = setup(); let calls = 0;
    const usecases = createMissionGenerationUsecases(repo, { generate: async () => {
      calls++; if (outcome === 'bad-output') return [];
      throw new AppError(outcome);
    } }, deps);
    await usecases.ensure(); await usecases.ensure();
    assert.equal(calls, 1); assert(repo.state.daily.missions.every(m => m.kind === 'new' && m.targetWord !== 'cup'));
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

test('fallback prefers unknown targets and aliases and fills three when the pool is exhausted', () => {
  const initial = generateDailyMissionsForDate('2026-11-04');
  const known = initial.flatMap(m => [m.targetWord, ...m.synonyms]);
  const fresh = generateDailyMissionsForDate('2026-11-04', known);
  assert.equal(fresh.length, 3);
  assert(fresh.every(m => !known.includes(m.targetWord)));
  assert.deepEqual(fresh, generateDailyMissionsForDate('2026-11-04', known));
  assert.equal(generateDailyMissionsForDate('2026-11-04', known.concat(fresh.flatMap(m => [m.targetWord, ...m.synonyms]))).length, 3);
});
test('AI rejects known aliases against the full collection', () => {
  const drafts = suggestions(); drafts[0].synonyms = ['cup'];
  const words = [word('cup')];
  assert.equal(generatedMissions(drafts, '2026-11-04', words), null);
});


test('rollover excludes yesterday including replaced words, and clears daily replacement limits', async () => {
  const { repo, deps, library, setNow } = setup();
  await createMissionGenerationUsecases(repo, { generate: async () => suggestions() }, deps).ensure();
  const original = repo.state.daily.missions[0];
  await library.replaceMission(original.id);
  const yesterdayNames = [...repo.state.daily.missions.flatMap(missionNames), ...missionNames(original)];
  setNow('2026-10-28T00:00:01'); await library.ensureMissionDay();
  assert(repo.state.daily.missions.every(m => !m.replaced && !missionNames(m).some(n => yesterdayNames.includes(n))));
  assert(missionNames(original).every(n => repo.state.daily.previousMissionWords?.includes(n)));
  let input: MissionContext | undefined;
  await createMissionGenerationUsecases(repo, { generate: async context => { input = context; return suggestions(); } }, deps).ensure();
  assert(input?.excludedWords?.includes('umbrella'));
  assert(repo.state.daily.generation?.status === 'ready' && repo.state.daily.generation.source === 'fallback');
  assert(repo.state.daily.missions.every(m => !missionNames(m).some(n => yesterdayNames.includes(n))));
});

test('replacement is atomic, persists across services and cannot replace completed or pending missions', async () => {
  const { repo, deps, library } = setup();
  const id = repo.state.daily.missions[0].id;
  await library.replaceMission(id); assert.equal(repo.state.daily.missions[0].id, id);
  await createMissionGenerationUsecases(repo, { generate: async () => suggestions() }, deps).ensure();
  const target = repo.state.daily.missions[0];
  await Promise.all([library.replaceMission(target.id), createLibraryUsecases(repo, deps).replaceMission(target.id)]);
  const replacement = structuredClone(repo.state.daily.missions[0]);
  assert(replacement.replaced); assert.notEqual(replacement.targetWord, target.targetWord);
  assert.equal(repo.state.daily.replacedMissionWords?.length, missionNames(target).length);
  await createLibraryUsecases(repo, deps).replaceMission(replacement.id);
  assert.deepEqual(repo.state.daily.missions[0], replacement);
  const completed = repo.state.daily.missions[1];
  await library.completeMission({ items: [word(completed.targetWord)], targetId: completed.id, analysisId: 'done' });
  await library.replaceMission(completed.id);
  assert(repo.state.daily.missions[1].isCompleted);
  validateDaily(repo.state.daily);
});

test('modified object names and plurals match without accepting unrelated compounds or example text', () => {
  const mission = { ...freshMissions().missions[0], targetWord: 'hanger', targetChinese: '衣架', synonyms: [] };
  for (const name of ['wooden hanger', 'a small wooden hanger', 'clothes hanger', 'wooden clothes hangers', 'HANGERS']) {
    assert.equal(checkMissionMatch(mission, [word(name)])?.word, name);
  }
  for (const name of ['hanger rack', 'hanger-shaped ornament', 'hanger holder', 'coat rack']) {
    assert.equal(checkMissionMatch(mission, [word(name)]), null);
  }
  assert.equal(checkMissionMatch(mission, [{ ...word('rack'), exampleEn: 'A wooden hanger on the rack.' }]), null);
});

test('AI rejects singular/plural variants of yesterday targets and aliases', () => {
  for (const [target, excluded] of [['chair', 'CHAIRS'], ['chairs', 'chair']]) {
    assert.equal(generatedMissions([draft(target), draft('umbrella'), draft('scarf')], '2026-11-02', [], [excluded]), null);
  }
  const drafts = suggestions(); drafts[0].synonyms = ['chairs'];
  assert.equal(generatedMissions(drafts, '2026-11-02', [], ['chair']), null);
});

test('rollover and replacement exclude plural variants from previous, current and discarded missions', async () => {
  const { repo, library, setNow } = setup();
  repo.state.daily = { ...freshMissions('2026-11-01'),
    missions: [draft('chairs'), draft('umbrella'), draft('scarf')].map((m, i) => ({ ...m, id: `2026-11-01_${i}`, isCompleted: false })),
  };
  const next = rollDate(repo.state.daily, '2026-11-02');
  assert.equal(next.missions.length, 3);
  assert(!next.missions.some(m => m.targetWord === 'chair'));
  for (let day = 1; day <= 30; day++) {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    setNow(`${date}T12:00:00`);
    for (const source of ['previous', 'current', 'discarded']) {
      repo.state.daily = { ...freshMissions(date),
        missions: [draft('umbrella'), draft(source === 'current' ? 'chairs' : 'scarf'), draft('vase')].map((m, i) => ({ ...m, id: `${date}_${i}`, isCompleted: false })),
        previousMissionWords: source === 'previous' ? ['CHAIRS'] : [],
        replacedMissionWords: source === 'discarded' ? ['chairs'] : [],
        generation: { status: 'ready', source: 'ai', generatedAt: 1 },
      };
      await library.replaceMission(`${date}_0`);
      assert(repo.state.daily.missions[0].replaced);
      assert.notEqual(repo.state.daily.missions[0].targetWord, 'chair', source);
    }
  }
});

test('yesterday avoidance stays deterministic across a year of fallback rollovers', () => {
  let state = freshMissions('2026-01-01');
  for (let day = 2; day <= 365; day++) {
    const date = new Date(2026, 0, day, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const excluded = state.missions.flatMap(missionNames);
    const next = rollDate(state, key);
    assert.equal(next.missions.length, 3);
    assert(next.missions.every(m => !missionNames(m).some(n => excluded.includes(n))));
    assert.deepEqual(next, rollDate(state, key)); state = next;
  }
});


test('every card remains replaceable once after all three cards were replaced yesterday', async () => {
  const { repo, deps, library, setNow } = setup();
  const generator = { generate: async () => { throw new AppError('MissingCredential'); } };
  await createMissionGenerationUsecases(repo, generator, deps).ensure();
  for (const mission of [...repo.state.daily.missions]) await library.replaceMission(mission.id);
  assert(repo.state.daily.missions.every(m => m.replaced));
  setNow('2026-10-28T12:00:00'); await library.ensureMissionDay();
  await createMissionGenerationUsecases(repo, generator, deps).ensure();
  for (const mission of [...repo.state.daily.missions]) await library.replaceMission(mission.id);
  assert(repo.state.daily.missions.every(m => m.replaced));
  assert.equal(new Set(repo.state.daily.missions.map(m => m.targetWord)).size, 3);
});

test('regular plurals match objects and are excluded from AI missions in either direction', () => {
  for (const [singular, plural] of [['watch', 'watches'], ['glass', 'glasses'], ['box', 'boxes'], ['bus', 'buses'], ['brush', 'brushes'], ['berry', 'berries'], ['shoe', 'shoes']]) {
    for (const [target, observed] of [[singular, plural], [plural, singular]]) {
      const mission = { ...freshMissions().missions[0], targetWord: target, synonyms: [] };
      assert(checkMissionMatch(mission, [word(observed)]), `${target} accepts ${observed}`);
      assert.equal(generatedMissions([draft(target), draft('umbrella'), draft('scarf')], '2026-11-06', [], [observed]), null);
      assert.equal(generatedMissions([draft(target), draft('umbrella'), draft('scarf')], '2026-11-06', [word(observed)]), null);
    }
  }
});

test('descriptive prefixes cannot bypass AI exclusions or known-word checks', () => {
  for (const [target, excluded] of [['chair', 'plastic chair'], ['plastic chair', 'chair'], ['wooden chair', 'small plastic chairs'], ['glass bottle', 'metal bottles']]) {
    assert.equal(generatedMissions([draft(target), draft('umbrella'), draft('scarf')], '2026-11-02', [], [excluded]), null);
    assert.equal(generatedMissions([draft(target), draft('umbrella'), draft('scarf')], '2026-11-02', [word(excluded)]), null);
  }
  // Material nouns remain distinct objects; unrelated compounds stay distinct.
  assert(generatedMissions([draft('glass'), draft('paper'), draft('scarf')], '2026-11-02', [], ['glass bottle', 'paper bag']));
  assert(generatedMissions([draft('hanger'), draft('umbrella'), draft('scarf')], '2026-11-02', [], ['hanger rack']));
  const specific = { ...freshMissions().missions[0], targetWord: 'glass bottle', synonyms: [] };
  assert.equal(checkMissionMatch(specific, [word('plastic bottle')]), null);
});

test('rollover and replacement exclude plural and descriptively named objects', async () => {
  const { repo, library, setNow } = setup();
  for (const [name, base] of [['watches', 'watch'], ['plastic chair', 'chair']]) {
    for (let day = 2; day <= 30; day++) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const previousDate = `2026-11-${String(day - 1).padStart(2, '0')}`;
      const state = { ...freshMissions(previousDate), missions: [draft(name), draft('umbrella'), draft('scarf')].map((m, i) => ({ ...m, id: `${previousDate}_${i}`, isCompleted: false })) };
      const next = rollDate(state, date);
      assert.equal(next.missions.length, 3);
      assert(!next.missions.some(m => m.targetWord === base), `${date} must exclude yesterday's ${name}`);
      setNow(`${date}T12:00:00`);
      for (const source of ['previous', 'current', 'discarded']) {
        repo.state.daily = { ...freshMissions(date),
          missions: [draft('umbrella'), draft(source === 'current' ? name : 'scarf'), draft('vase')].map((m, i) => ({ ...m, id: `${date}_${i}`, isCompleted: false })),
          previousMissionWords: source === 'previous' ? [name] : [],
          replacedMissionWords: source === 'discarded' ? [name] : [],
          generation: { status: 'ready', source: 'ai', generatedAt: 1 },
        };
        await library.replaceMission(`${date}_0`);
        assert(repo.state.daily.missions[0].replaced);
        assert.notEqual(repo.state.daily.missions[0].targetWord, base, `${source}: ${name}`);
      }
    }
  }
});
