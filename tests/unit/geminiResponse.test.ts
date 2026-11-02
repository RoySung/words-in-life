import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeResponse } from '../../src/repository/gemini/response';
import { AppError } from '../../src/repository/LibraryRepository';

const response = (item: object) => JSON.stringify({ isRecognizable: true, items: [{ word: 'tennis racket', chinese: '網球拍', ...item }] });

test('Gemini normalized boxes become full-photo percentages with axes in the correct order', () => {
  const result = decodeResponse(response({ box_2d: [180, 320, 520, 540] }));
  assert(result.success);
  assert.deepEqual(result.data.items[0].boundingBox, { left: 32, top: 18, right: 54, bottom: 52 });
  const edge = decodeResponse(response({ box_2d: [0, 0, 1000, 1000] }));
  assert(edge.success);
  assert.deepEqual(edge.data.items[0].boundingBox, { left: 0, top: 0, right: 100, bottom: 100 });
  const small = decodeResponse(response({ box_2d: [10, 20, 50, 80] }));
  assert(small.success);
  assert.deepEqual(small.data.items[0].boundingBox, { left: 2, top: 1, right: 8, bottom: 5 }, 'small normalized values must not be mistaken for percentages');
});

test('missing or malformed Gemini bounds fail instead of silently cropping the full scene', () => {
  for (const box_2d of [undefined, null, [], [10, 20, 30], [10, 20, 30, 40, 50],
    ['10', 20, 30, 40], [-1, 20, 30, 40], [10, 20, 1001, 40],
    [30, 20, 10, 40], [10, 40, 30, 20], [10, 20, 10, 40], [10, 20, 30, 20]]) {
    assert.throws(() => decodeResponse(response({ box_2d })), (error: AppError) => error.code === 'InvalidResponse');
  }
  assert.throws(() => decodeResponse(response({ boundingBox: { left: 32, top: 18, right: 54, bottom: 52 } })),
    (error: AppError) => error.code === 'InvalidResponse', 'the provider contract must use one explicit coordinate format');
});

test('unrecognizable Gemini responses do not require object bounds', () => {
  const result = decodeResponse(JSON.stringify({ isRecognizable: false, items: [], unrecognizableReason: '畫面模糊' }));
  assert.equal(result.success, false);
});
