import { PhotoImage, type PhotoUrls } from '../hooks/usePhotoUrl';
import type { PhotoRef } from '../domain/photos';
import { ChevronLeft, Volume2 } from 'lucide-react';
import { IconButton, PhotoMarker } from '../design-system/components';
import { useDialog } from '../hooks/useDialog';
import { speakEnglish } from '../utils/audio';
interface PhotoSourceModalProps { photo?: PhotoRef; photoUrls?: PhotoUrls; isOpen: boolean; onClose: () => void; originalImageUrl: string; stickerUrl?: string; word: string; chinese: string; emoji: string; position?: { x: number; y: number }; sceneTitle?: string; }
function PhotoSourceContent({ photo, photoUrls, onClose, originalImageUrl, word, chinese, position, sceneTitle }: PhotoSourceModalProps) {
  const dialog = useDialog(onClose);
  return <dialog ref={dialog} className="word-dialog source-dialog" aria-label={`${word} 的原始照片`}><header className="page-header"><IconButton label="關閉原圖" onClick={onClose}><ChevronLeft /></IconButton><span>{sceneTitle || '拍攝時的風景'}</span><IconButton label={`播放 ${word} 發音`} onClick={() => speakEnglish(word)}><Volume2 /></IconButton></header><figure className="vs-polaroid vs-polaroid--taped"><div className="scene-image"><PhotoImage photo={photo} urls={photoUrls} src={originalImageUrl} alt={`${word} 的原始照片`} />{position && <PhotoMarker label={word} x={Math.min(70,Math.max(5,position.x))} y={Math.min(85,Math.max(5,position.y))} onClick={() => speakEnglish(word)} />}</div><figcaption><strong>{word}</strong> · {chinese}</figcaption></figure></dialog>;
}
export function PhotoSourceModal(props: PhotoSourceModalProps) { return props.isOpen ? <PhotoSourceContent {...props} /> : null; }
