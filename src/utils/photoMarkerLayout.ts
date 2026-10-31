export interface LabelBox { x: number; y: number; width: number; height: number }
export interface MarkerSize { x: number; y: number; width: number; height: number }
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
const overlap = (a: LabelBox, b: LabelBox) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/** Move labels only. Object anchors always remain in source-photo coordinates. */
export function layoutPhotoLabels(markers: MarkerSize[], width: number, height: number): LabelBox[] {
  const placed: LabelBox[] = [];
  const anchors = markers.map(marker => ({ x: marker.x / 100 * width, y: marker.y / 100 * height }));
  const dots = anchors.map(point => ({ x: point.x - 12, y: point.y - 12, width: 24, height: 24 }));
  return markers.map((marker, index) => {
    const anchor = anchors[index];
    const maxX = Math.max(0, width - marker.width - 3);
    const maxY = Math.max(0, height - marker.height - 3);
    const preferredX = marker.x > 60 ? anchor.x - marker.width - 14 : anchor.x + 14;
    const xs = [clamp(preferredX, maxX), clamp(anchor.x - marker.width / 2, maxX), maxX];
    const ys = [clamp(anchor.y - marker.height / 2, maxY), clamp(anchor.y - marker.height - 14, maxY), clamp(anchor.y + 14, maxY), maxY];
    for (let x = 3; x < maxX; x += 8) xs.push(x);
    for (let y = 3; y < maxY; y += 8) ys.push(y);
    let best: LabelBox = { x: xs[0], y: ys[0], width: marker.width, height: marker.height };
    let bestScore = Infinity;
    for (const x of xs) for (const y of ys) {
      const candidate = { x, y, width: marker.width, height: marker.height };
      const padded = { x: x - 3, y: y - 3, width: marker.width + 6, height: marker.height + 6 };
      const collision = [...placed, ...dots].reduce((sum, other) => sum + overlap(padded, other), 0);
      const dx = anchor.x - Math.max(x, Math.min(x + marker.width, anchor.x));
      const dy = anchor.y - Math.max(y, Math.min(y + marker.height, anchor.y));
      const score = collision * 1e6 + dx * dx + dy * dy + .05 * ((x - preferredX) ** 2 + (y + marker.height / 2 - anchor.y) ** 2);
      if (score < bestScore) { best = candidate; bestScore = score; }
    }
    placed.push(best);
    return best;
  });
}
