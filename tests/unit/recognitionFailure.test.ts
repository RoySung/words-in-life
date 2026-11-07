import test from 'node:test';
import assert from 'node:assert/strict';
import { recognitionFailure } from '../../src/features/recognition/failure';
import { errorDiagnostics } from '../../src/utils/errorDiagnostics';
import { AppError } from '../../src/repository/LibraryRepository';

test('recognition failures distinguish incomplete results, timeout, credentials, quota and service errors', () => {
  for (const [code, title] of [
    ['InvalidResponse', '這次辨識結果不完整'], ['Timeout', '這次辨識花太久時間'],
    ['MissingCredential', '尚未設定辨識服務'], ['Unauthorized', '無法使用辨識服務'],
    ['RateLimited', '辨識額度不足或請求過於頻繁'], ['Unavailable', '辨識服務暫時無法使用'],
    ['InvalidInput', '這張照片無法送出辨識'],
  ] as const) {
    const info = recognitionFailure(new AppError(code), 'photo-B');
    assert.equal(info.title, title);
    assert.equal(info.photoUrl, 'photo-B');
    assert.match(info.diagnostics!, new RegExp(code));
  }
  const timeout = recognitionFailure(new AppError('Timeout'), 'photo');
  assert.doesNotMatch(timeout.title, /網路不穩/);
  assert.match(timeout.suggestions.join(''), /不必立即重拍/);
  const unknown = recognitionFailure(new Error('internal provider details'), 'photo');
  assert.doesNotMatch(unknown.description, /internal provider details/);
});

test('diagnostics preserve cause and status but exclude credentials, photos, request fields and stacks', () => {
  const secret = 'private-test-secret';
  const detail = Object.assign(new Error(`key=${secret} authorization: Bearer token123 data:image/jpeg;base64,ABC ${'B'.repeat(200)}`), {
    status: 403, request: { photo: 'sensitive-photo', apiKey: secret },
  });
  const log = errorDiagnostics(new AppError('Unauthorized', undefined, { cause: detail }), [secret]);
  assert.match(log, /Unauthorized/);
  assert.match(log, /"status": 403/);
  assert.doesNotMatch(log, /private-test-secret|token123|data:image|base64|sensitive-photo|stack/);
  const circular = new Error('cycle'); circular.cause = circular;
  assert.equal(JSON.parse(errorDiagnostics(circular)).errors.length, 1);
  assert.match(errorDiagnostics({ secret }), /UnknownError/);
});
