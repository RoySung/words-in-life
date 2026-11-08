import test from 'node:test';
import assert from 'node:assert/strict';
import { standardRearCameraId } from '../../src/utils/cameraDevice';

const device = (deviceId: string, label: string, kind: MediaDeviceKind = 'videoinput') => ({ deviceId, label, kind });

test('selects the standard rear lens from localized names without relying on device order', () => {
  for (const label of ['Back Camera', 'Rear Wide Camera', 'Back Wide-Angle Camera', '後置相機', '背面相機', '後置廣角相機', '后置摄像头', '背面カメラ', 'Rückkamera', 'Caméra arrière']) {
    assert.equal(standardRearCameraId([
      device('virtual', 'Back Triple Camera'), device('front', 'Front Camera'),
      device('ultra', 'Back Ultra Wide Camera'), device('physical', label),
    ]), 'physical', label);
  }
});

test('does not guess a lens from virtual, ultrawide, telephoto, front or hidden labels', () => {
  assert.equal(standardRearCameraId([
    device('1', 'Back Triple Camera'), device('2', 'Back Dual Wide Camera'),
    device('3', 'Back Ultra Wide Camera'), device('4', 'Back Telephoto Camera'),
    device('5', 'Front Camera'), device('6', '後置三相機'), device('7', '後置超廣角相機'),
    device('8', ''), device('9', 'Unrecognized Camera'), device('', 'Back Camera'),
    device('audio', 'Back Camera', 'audioinput'),
  ]), undefined);
});
