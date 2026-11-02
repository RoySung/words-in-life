import { parseRecognitionResponse } from '../../domain/recognition';
import { parseBoundingBox, record } from '../../domain/validation';
import { AppError } from '../LibraryRepository';
export function decodeResponse(text: string | undefined) {
  try {
    const raw: unknown = JSON.parse(text || '{}');
    if (record(raw) && raw.isRecognizable === true && Array.isArray(raw.items)) {
      raw.items = raw.items.map(item => {
        if (!record(item)) throw new Error('Invalid object');
        // Gemini's box_2d uses [ymin, xmin, ymax, xmax] on a 0–1000 grid.
        // Convert once at the provider boundary; stored/domain boxes stay 0–100.
        const box = item.box_2d;
        if (!Array.isArray(box) || box.length !== 4 || !box.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000)) {
          throw new Error('Missing or invalid object bounds');
        }
        const [top, left, bottom, right] = box;
        const boundingBox = parseBoundingBox({ left: left / 10, top: top / 10, right: right / 10, bottom: bottom / 10 });
        if (!boundingBox) throw new Error('Empty or reversed object bounds');
        return { ...item, boundingBox };
      });
    }
    return parseRecognitionResponse(raw);
  }
  catch (cause) { throw new AppError('InvalidResponse', undefined, { cause }); }
}
