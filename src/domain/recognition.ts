import type { VocabularyItem } from './vocabulary';
export type FailureReasonCode = 'BLURRY_OR_DARK' | 'NO_ITEMS_FOUND' | 'TOO_FAR_OR_SMALL' | 'TARGET_QUEST_MISSED' | 'NETWORK_ERROR' | 'GENERIC_ERROR';
import { parseItem, record, strings, text } from './validation';

export type RecognitionResponse =
  | { success: true; data: { sceneTitle: string; sceneDescription: string; items: VocabularyItem[] } }
  | { success: false; reasonCode: FailureReasonCode; title: string; description: string; suggestions: string[] };

export function parseRecognitionResponse(raw: unknown): RecognitionResponse {
  if (!record(raw) || typeof raw.isRecognizable !== 'boolean' || !Array.isArray(raw.items)) {
    throw new Error('辨識回應格式不正確，請重新辨識。');
  }
  if (!raw.isRecognizable || raw.items.length === 0) {
    const title = text(raw.unrecognizableReason, '未能從照片中辨識出清晰的具體物品');
    const reasonCode: FailureReasonCode = /暗|黑|光線|模糊|晃動/.test(title) ? 'BLURRY_OR_DARK' : /遠|小|距離/.test(title) ? 'TOO_FAR_OR_SMALL' : 'NO_ITEMS_FOUND';
    const tips = strings(raw.photographyTips).slice(0, 3);
    return { success: false, reasonCode, title,
      description: '未能在此照片中鎖定清晰的日常物品，請換個角度或環境再次嘗試。',
      suggestions: tips.length ? tips : ['增加光線或靠近窗邊自然光', '將物品放置於鏡頭中心', '保持相機穩定並對焦'],
    };
  }
  const items = raw.items.slice(0, 8).map(parseItem);
  if (items.some(item => !item)) throw new Error('辨識回應的單字資料不完整，請重新辨識。');
  const unique = [...new Map(items.map(item => [item!.id, item!])).values()];
  return { success: true, data: { sceneTitle: text(raw.sceneTitle, '辨識場景'), sceneDescription: text(raw.sceneDescription, 'AI 辨識出的日常物品'), items: unique } };
}
