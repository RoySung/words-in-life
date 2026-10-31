import { useLayoutEffect, useRef, useState } from 'react';
import { PhotoMarker } from '../design-system/components';
import { layoutPhotoLabels, type LabelBox } from '../utils/photoMarkerLayout';

interface Marker { id: string; label: string; x: number; y: number; onClick: () => void }
const intersects = (a: LabelBox, b: LabelBox) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function PhotoMarkers({ markers }: { markers: Marker[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ width: number; height: number; boxes: LabelBox[] }>();
  const signature = JSON.stringify(markers.map(({ id, label, x, y }) => [id, label, x, y]));
  useLayoutEffect(() => {
    const layer = ref.current!;
    const measure = () => {
      const width = layer.clientWidth, height = layer.clientHeight;
      if (!width || !height) return;
      const labels = Array.from(layer.querySelectorAll<HTMLElement>('.vs-marker-label'));
      const boxes = layoutPhotoLabels(markers.map((marker, index) => ({ ...marker, width: labels[index].offsetWidth, height: labels[index].offsetHeight })), width, height);
      setLayout(previous => JSON.stringify(previous) === JSON.stringify({ width, height, boxes }) ? previous : { width, height, boxes });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    layer.querySelectorAll('.vs-marker-label').forEach(label => observer.observe(label));
    return () => observer.disconnect();
  }, [signature]);
  // Very small photos may not have room for every label. Keep their dots usable.
  const compact = layout && layout.boxes.some((box, index) => box.x + box.width > layout.width || box.y + box.height > layout.height ||
    layout.boxes.slice(index + 1).some(other => intersects(box, other)) ||
    markers.some(marker => intersects(box, { x: marker.x / 100 * layout.width - 12, y: marker.y / 100 * layout.height - 12, width: 24, height: 24 })));
  return <div className={`photo-markers${compact ? ' photo-markers--compact' : ''}`} ref={ref} data-layout-width={layout?.width}>
    {layout && <svg className="photo-marker-lines" width="100%" height="100%" aria-hidden="true">{markers.map((marker, index) => {
      const box = layout.boxes[index];
      if (!box) return null;
      const x = marker.x / 100 * layout.width, y = marker.y / 100 * layout.height;
      return <line key={marker.id} x1={x} y1={y} x2={Math.max(box.x, Math.min(box.x + box.width, x))} y2={Math.max(box.y, Math.min(box.y + box.height, y))} />;
    })}</svg>}
    {markers.map((marker, index) => {
      const box = layout?.boxes[index];
      return <PhotoMarker key={marker.id} {...marker} labelOffset={box && layout ? { x: box.x - marker.x / 100 * layout.width, y: box.y - marker.y / 100 * layout.height } : undefined} />;
    })}
  </div>;
}
