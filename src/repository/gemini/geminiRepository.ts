import type { RecognitionRepository } from '../RecognitionRepository';
import { generateGeminiJson, GEMINI_MODELS } from './client';
import { makeRequest } from './request';
import { decodeResponse } from './response';

export function createGeminiRepository(getKey: () => string, models = GEMINI_MODELS): RecognitionRepository {
  return { async analyze(input, { signal }) {
    const request = makeRequest(input);
    return decodeResponse(await generateGeminiJson(getKey, { contents: request.contents,
      config: { responseSchema: request.schema, temperature: .2 } }, { signal, models }));
  } };
}
