export const GEMINI_KEY_STORAGE = 'words-in-life-gemini-key-v1';

export function readGeminiKey(): string {
  try { return localStorage.getItem(GEMINI_KEY_STORAGE)?.trim() || ''; }
  catch { return ''; }
}

export function saveGeminiKey(key: string): void {
  if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key);
  else localStorage.removeItem(GEMINI_KEY_STORAGE);
}
