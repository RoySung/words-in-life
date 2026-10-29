import { parseRecognitionResponse } from '../../domain/recognition';
import { AppError } from '../LibraryRepository';
export function decodeResponse(text: string | undefined) {
  try { return parseRecognitionResponse(JSON.parse(text || '{}')); }
  catch (cause) { throw new AppError('InvalidResponse', undefined, { cause }); }
}
