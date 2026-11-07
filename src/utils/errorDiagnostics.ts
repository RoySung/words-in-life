import { AppError } from '../repository/LibraryRepository';

/** Keep diagnostics useful without copying credentials, images or request objects. */
export function redactDiagnosticText(value: string, secrets: string[] = []) {
  let text = value;
  for (const secret of secrets) if (secret) text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/data:[^\s"']+/gi, '[IMAGE REDACTED]')
    .replace(/AIza[\w-]+/g, '[REDACTED]')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/((?:api[_-]?key|x-goog-api-key|authorization|key)["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, '$1[REDACTED]')
    .replace(/[A-Za-z0-9+/=_-]{80,}/g, '[DATA REDACTED]')
    .slice(0, 2000);
}

export function errorDiagnostics(cause: unknown, secrets: string[] = []) {
  const errors: { name: string; code?: string; status?: number; message: string }[] = [];
  const seen = new Set<unknown>();
  let current = cause;
  while (current instanceof Error && !seen.has(current) && errors.length < 5) {
    seen.add(current);
    const status = 'status' in current && typeof current.status === 'number' ? current.status : undefined;
    errors.push({ name: redactDiagnosticText(current.name, secrets),
      code: current instanceof AppError ? current.code : undefined, status,
      message: redactDiagnosticText(current.message, secrets) });
    current = current.cause;
  }
  return JSON.stringify({ time: new Date().toISOString(), errors: errors.length ? errors : [{ name: 'UnknownError', message: 'No error details available' }] }, null, 2);
}
