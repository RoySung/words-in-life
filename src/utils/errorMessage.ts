import { AppError } from '../repository/LibraryRepository';
const messages: Record<string, string> = {
  MissingCredential: '請先在設定頁設定 Gemini API key。', Unauthorized: '無法使用 Gemini，請到設定頁確認 API key 與存取權限。',
  RateLimited: 'Gemini 可用額度不足或請求過於頻繁，請稍後重試。', InvalidInput: '照片請求無法處理，請換一張照片重試。',
  InvalidResponse: '辨識回應資料不完整，請重新辨識。', Timeout: '照片辨識逾時，請檢查網路後重試。',
  Unavailable: '服務暫時無法使用，請稍後重試。', Conflict: '其他分頁正在更新資料，請重試。',
  NotFound: '這個單字已被移除，請重新開啟單字本。', InvalidData: '資料格式無法讀取，原始資料仍保留。',
  QuotaExceeded: '儲存空間不足，這次變更尚未保存，請重試。', Unexpected: '無法儲存變更，這次變更尚未保存，請重試。',
};
export function errorMessage(cause: unknown) {
  return cause instanceof AppError ? messages[cause.code] || '操作未完成，請重試。' : cause instanceof Error ? cause.message : '操作未完成，請重試。';
}
