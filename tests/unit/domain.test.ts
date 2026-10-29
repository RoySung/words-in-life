import test from 'node:test';
import type { SavedWord } from '../../src/types';
import assert from 'node:assert/strict';
import { parseItem, coordinate } from '../../src/domain/validation';
import { parseRecognitionResponse } from '../../src/features/recognition/response';
import { checkMissionMatch, completeMission, freshMissions, rollDate, yesterday } from '../../src/features/missions/rules';
import { MISSION_POOL } from '../../src/data/dailyMissions';
import { reviewWord } from '../../src/features/collection/review';

const item = (word: string) => parseItem({ word, chinese: '物品', position: { x: 50, y: 50 } })!;

test('mission matching only accepts full explicit aliases, not substrings or collocations', () => {
  const mission = { ...MISSION_POOL.find(m => m.targetWord === 'pen')!, isCompleted: false };
  assert.equal(checkMissionMatch(mission, [item('open book')]), null);
  assert.equal(checkMissionMatch(mission, [{ ...item('table'), collocations: ['a pen on a table'] }]), null);
  assert.equal(checkMissionMatch(mission, [item('pencil case')]), null);
  assert.equal(checkMissionMatch(mission, [item(' PEN ')])?.word, 'PEN');
  assert.equal(checkMissionMatch(mission, [item('ballpoint pen')])?.word, 'ballpoint pen');
});

test('streak starts at one after all missions, increments on consecutive days, resets after gaps', () => {
  const finishDay = (state: ReturnType<typeof freshMissions>, date: string) => {
    let next = rollDate(state, date);
    for (const mission of next.missions) next = completeMission(next, [item(mission.targetWord)], { kind: 'asset', path: '/photo.jpg' }, mission.id, new Date(`${date}T12:00:00`)).state;
    return next;
  };
  let state = freshMissions('2026-10-27');
  assert.equal(state.streak, 0);
  state = finishDay(state, '2026-10-27'); assert.equal(state.streak, 1);
  state = finishDay(state, '2026-10-27'); assert.equal(state.streak, 1);
  state = finishDay(state, '2026-10-28'); assert.equal(state.streak, 2);
  assert.equal(rollDate(state, '2026-10-30').streak, 0);
  state = finishDay(state, '2026-10-30'); assert.equal(state.streak, 1);
  assert.equal(state.lastCompletedDate, '2026-10-30');
});

test('midnight processing rolls over before matching and drops previous photos', () => {
  const old = freshMissions('2026-10-27');
  old.missions[0] = { ...old.missions[0], isCompleted: true, completedPhoto: { kind: 'asset', path: '/old.jpg' } };
  const result = completeMission(old, [], { kind: 'asset', path: '/new.jpg' }, old.missions[0].id, new Date('2026-10-28T00:01:00'));
  assert.equal(result.state.dateKey, '2026-10-28');
  assert(result.state.missions.every(m => !m.isCompleted && !m.completedPhoto && m.id.startsWith('2026-10-28')));
  assert.equal(yesterday('2026-01-01'), '2025-12-31');
  assert.equal(yesterday('2024-03-01'), '2024-02-29');
});

test('missions are deterministic and unique across a year', () => {
  for (let day = 1; day <= 365; day++) {
    const date = new Date(2026, 0, day).toISOString().slice(0, 10);
    const a = freshMissions(date); assert.deepEqual(a, freshMissions(date));
    assert.equal(new Set(a.missions.map(m => m.targetWord)).size, 3);
  }
});

test('AI boundary rejects malformed objects and creates stable unique IDs', () => {
  for (const raw of [null, {}, { isRecognizable: 'yes', items: [] }, { isRecognizable: true, items: [{ word: 42, chinese: '物品' }] }]) assert.throws(() => parseRecognitionResponse(raw));
  const response = parseRecognitionResponse({ isRecognizable: true, sceneTitle: {}, items: [item('cup'), { ...item('book'), id: 'same' }, { ...item('CUP'), id: 'same' }] });
  assert(response.success);
  assert.deepEqual(response.data.items.map(i => i.id), ['word:cup', 'word:book']);
  assert.equal(response.data.sceneTitle, '辨識場景');
  const failure = parseRecognitionResponse({ isRecognizable: false, unrecognizableReason: {}, photographyTips: [null, '試試亮一點'], items: [] });
  assert.equal(failure.success, false);
});

test('coordinate clamping applies to fractions, invalid values and both axes', () => {
  assert.equal(coordinate(.01, 8, 92), 8);
  assert.equal(coordinate(.99, 12, 88), 88);
  assert.equal(coordinate(Infinity, 8, 92), 50);
  assert.equal(coordinate('50', 8, 92), 50);
});

test('review summaries persist counts without claiming spaced repetition', () => {
  let word: SavedWord = { ...item('cup'), savedAt: 0 };
  word = reviewWord(word, true, 100);
  word = reviewWord(word, false, 200);
  assert.equal(word.reviewCount, 2); assert.equal(word.rememberedCount, 1);
  assert.equal(word.masteryScore, 50); assert.equal(word.lastReviewedAt, 200);
});
