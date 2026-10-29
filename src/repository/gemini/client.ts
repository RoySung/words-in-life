import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';
import { record } from '../../domain/validation';
import { AppError } from '../LibraryRepository';

export const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
export async function generateGeminiJson(getKey: () => string, request: Omit<GenerateContentParameters, 'model'>,
  { signal, models = GEMINI_MODELS }: { signal: AbortSignal; models?: string[] }) {
  signal.throwIfAborted();
  const key = getKey().trim();
  if (!key) throw new AppError('MissingCredential');
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } });
  let transientRetries = 0;
  for (let modelIndex = 0; modelIndex < models.length;) {
    signal.throwIfAborted();
    try {
      const response = await ai.models.generateContent({ ...request, model: models[modelIndex],
        config: { ...request.config, responseMimeType: 'application/json', abortSignal: signal } });
      signal.throwIfAborted();
      return response.text;
    } catch (cause) {
      signal.throwIfAborted();
      if (cause instanceof AppError) throw cause;
      const status = record(cause) ? Number(cause.status) : 0;
      if (status === 404 && modelIndex + 1 < models.length) { modelIndex++; continue; }
      if (status === 401 || status === 403) throw new AppError('Unauthorized');
      if (status === 400) throw new AppError('InvalidInput');
      if (status === 429) throw new AppError('RateLimited');
      if ((!status || status >= 500 || status === 408) && transientRetries++ === 0) {
        await new Promise<void>((resolve, reject) => {
          const finish = () => { signal.removeEventListener('abort', cancel); resolve(); };
          const timer = setTimeout(finish, 200);
          const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(signal.reason); };
          signal.addEventListener('abort', cancel, { once: true });
          if (signal.aborted) cancel();
        });
        continue;
      }
      throw new AppError('Unavailable', undefined, { cause });
    }
  }
  throw new AppError('Unavailable');
}
