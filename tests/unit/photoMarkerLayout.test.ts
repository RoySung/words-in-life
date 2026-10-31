import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutPhotoLabels, type LabelBox } from '../../src/utils/photoMarkerLayout';
const overlaps = (a: LabelBox, b: LabelBox) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('nearby photo labels stay clickable without covering each other or their anchors', () => {
  for (const [width, height] of [[260, 190], [340, 240], [400, 650]]) {
    const markers = Array.from({ length: 8 }, (_, i) => ({ x: 45 + i * 1.5, y: 45 + i, width: 65, height: 36 }));
    const original = structuredClone(markers);
    const boxes = layoutPhotoLabels(markers, width, height);
    assert.deepEqual(markers, original, 'layout must never mutate recognition coordinates');
    for (const [index, box] of boxes.entries()) {
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
      for (const other of boxes.slice(index + 1)) assert(!overlaps(box, other), `overlapping labels at ${width}x${height}`);
      for (const marker of markers) assert(!overlaps(box, { x: marker.x / 100 * width - 12, y: marker.y / 100 * height - 12, width: 24, height: 24 }), 'label must not block object dot');
    }
  }
});

test('long multi-line labels near image edges stay within the photo after resizing', () => {
  const markers = [{ x: 8, y: 12, width: 112, height: 58 }, { x: 92, y: 88, width: 112, height: 58 }, { x: 90, y: 15, width: 95, height: 36 }];
  for (const [width, height] of [[260, 190], [400, 300], [280, 500]]) {
    const boxes = layoutPhotoLabels(markers, width, height);
    for (const [index, box] of boxes.entries()) {
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
      for (const other of boxes.slice(index + 1)) assert(!overlaps(box, other));
    }
  }
});
