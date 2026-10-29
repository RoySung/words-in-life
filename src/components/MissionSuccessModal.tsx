import { Check, Volume2 } from 'lucide-react';
import { DailyMission, DetectedItem } from '../types';
import { speakEnglish } from '../utils/audio';
import { Button, IconButton, Polaroid } from '../design-system/components';
import { useDialog } from '../hooks/useDialog';
interface MissionSuccessModalProps { storageError?: string; isOpen: boolean; onClose: () => void; mission: DailyMission; matchedItem: DetectedItem; onSaveWord?: (item: DetectedItem) => void; isSaved?: boolean; }
function MissionContent({ storageError, onClose, mission, matchedItem, onSaveWord, isSaved }: MissionSuccessModalProps) {
  const ref = useDialog(onClose);
  return <dialog ref={ref} className="mission-dialog" aria-label="今日任務完成">{storageError && <p role="alert" className="vs-error">{storageError}</p>}<Check /><h1>找到今天的小發現！</h1><p>已完成「{mission.targetChinese}」尋寶任務。</p>{matchedItem.stickerUrl && <Polaroid src={matchedItem.stickerUrl} alt={matchedItem.chinese} taped><strong>{matchedItem.word}</strong><IconButton label="播放發音" onClick={() => speakEnglish(matchedItem.word)}><Volume2 /></IconButton></Polaroid>}<div className="stack-actions"><Button disabled={isSaved} onClick={() => onSaveWord?.(matchedItem)}>{isSaved ? '已加入單字本' : '加入單字本'}</Button><Button variant="secondary" onClick={onClose}>繼續探索照片</Button></div></dialog>;
}
export function MissionSuccessModal(props: MissionSuccessModalProps) { return props.isOpen ? <MissionContent {...props} /> : null; }
