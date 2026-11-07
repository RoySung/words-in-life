import { AppError } from '../../repository/LibraryRepository';
import type { RecognitionFailureInfo } from '../../types';
import { errorDiagnostics } from '../../utils/errorDiagnostics';

type Presentation = Pick<RecognitionFailureInfo, 'title' | 'description' | 'suggestions' | 'recovery'>;
const retry = ['先重新辨識這張照片；若持續失敗，再靠近單一物品重拍。'];
const presentations: Partial<Record<AppError['code'], Presentation>> = {
  InvalidResponse: { title: '這次辨識結果不完整', description: '未能取得完整的辨識資料，目前無法確認是否與照片內容有關。', suggestions: retry, recovery: 'retry' },
  Timeout: { title: '這次辨識花太久時間', description: '照片處理或服務回應超過等待時間，無法確認是連線還是分析耗時。', suggestions: ['先重試這張照片，不必立即重拍。', '若持續逾時，請檢查連線，或靠近單一物品重拍。'], recovery: 'retry' },
  Unavailable: { title: '辨識服務暫時無法使用', description: '這次未能完成辨識，目前無法判斷照片內容。', suggestions: ['不必立即重拍，請稍後重新辨識本圖。', '若持續失敗，請檢查網路連線。'], recovery: 'retry' },
  MissingCredential: { title: '尚未設定辨識服務', description: '請開啟設定，填入 Gemini API key 後，返回重試這張照片。', suggestions: ['不必重拍，設定完成後可使用原照片。'], recovery: 'settings' },
  Unauthorized: { title: '無法使用辨識服務', description: 'API key 或存取權限未通過驗證，請開啟設定確認 Gemini API key 與權限，再返回重試原照片。', suggestions: ['重拍無法解決權限問題，請先確認設定。'], recovery: 'settings' },
  RateLimited: { title: '辨識額度不足或請求過於頻繁', description: 'Gemini 目前無法接受這次請求，請稍後重試，或確認 API key 的可用額度。', suggestions: ['不必重拍，可稍後重新辨識本圖。'], recovery: 'retry' },
  InvalidInput: { title: '這張照片無法送出辨識', description: '辨識服務無法處理這次照片請求。', suggestions: ['先重試這張照片；若仍失敗，請選擇其他照片或重新拍攝。'], recovery: 'retry' },
};
export function recognitionFailure(cause: unknown, photoUrl: string, secrets: string[] = []): RecognitionFailureInfo {
  const code = cause instanceof AppError ? cause.code : undefined;
  return { reasonCode: code === 'Timeout' ? 'NETWORK_ERROR' : 'GENERIC_ERROR', photoUrl,
    ...(code && presentations[code] || { title: '這次未能完成辨識', description: '發生未預期的錯誤，目前無法確認原因。', suggestions: ['先重新辨識本圖，不必立即重拍。', '若持續失敗，可稍後再試或選擇其他照片。'], recovery: 'retry' as const }),
    diagnostics: errorDiagnostics(cause, secrets),
  };
}
