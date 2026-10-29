import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Image as ImageIcon, AlertCircle, Lightbulb } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { playSfx } from '../utils/audio';
import { DailyMission, RecognitionFailureInfo } from '../types';
import { Button, IconButton, ShutterButton } from '../design-system/components';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeQuestTarget?: DailyMission | null;
  onSelectFailureDemo?: (demoInfo: RecognitionFailureInfo) => void;
}

const CameraContent: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onSelectFile,
  activeQuestTarget,
  onSelectFailureDemo,
}) => {
  const dialog = useDialog(onClose);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let disposed = false;
    let ownedStream: MediaStream | undefined;
    setCameraError(null);
    setStream(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
        const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (disposed) { next.getTracks().forEach(t => t.stop()); return; }
        ownedStream = next;
        setStream(next);
        if (videoRef.current) videoRef.current.srcObject = next;
      } catch (error) {
        if (!disposed) setCameraError(error instanceof Error && error.name === 'NotAllowedError' ? '相機權限尚未開啟。請允許瀏覽器使用相機，或從相簿選取照片。' : '無法啟動相機，請從相簿選取照片。');
      }
    })();
    return () => { disposed = true; ownedStream?.getTracks().forEach(t => t.stop()); };
  }, [isOpen, facingMode]);
  const handleFlipCamera = () => setFacingMode(mode => mode === 'environment' ? 'user' : 'environment');
  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0);
    playSfx('shutter');
    onCapture(canvas.toDataURL('image/jpeg', .88));
  };
  if (!isOpen) return null;
  return <dialog ref={dialog} className="camera-overlay" aria-label="拍攝照片">
    <header className="page-header"><IconButton autoFocus label="關閉相機" onClick={onClose}><X /></IconButton><span>Words in Life</span><IconButton label="拍照提示" aria-expanded={showTips} onClick={() => setShowTips(!showTips)}><Lightbulb /></IconButton></header>
    <div className="camera-top"><span className="camera-model">INSTANT LEARNING</span><div className="camera-stripes" aria-hidden="true"><i /><i /><i /></div><div className="camera-lens" aria-hidden="true" /></div>
    <main className="live-viewfinder">{cameraError ? <div className="camera-error" role="alert"><AlertCircle /><p>{cameraError}</p><Button onClick={() => fileInputRef.current?.click()}>從相簿選取照片</Button></div> : <><video ref={videoRef} autoPlay playsInline muted /><div className="viewfinder-corners" /><p className="live-hint">{activeQuestTarget ? `尋找 ${activeQuestTarget.targetWord} · ${activeQuestTarget.targetChinese}` : '將想學英文的物品對準畫面'}</p>{isFlashing && <div className="shutter-flash" />}</>}</main>
    {showTips && <aside className="camera-tips"><p>靠近自然光，將物品置中，保持鏡頭穩定後按下快門。</p></aside>}
    <div className="camera-controls"><IconButton label="從相簿選取照片" onClick={() => fileInputRef.current?.click()}><ImageIcon /></IconButton><ShutterButton onClick={handleTakePhoto} disabled={!!cameraError || !stream} /><IconButton label="切換前後鏡頭" onClick={handleFlipCamera}><RefreshCw /></IconButton></div>
    <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={e => { if (e.target.files?.length) { onSelectFile(e); onClose(); } }} /><div className="camera-print-slot">SNAP · LEARN · GROW</div>
  </dialog>;
};
export function CameraModal(props: CameraModalProps) { return props.isOpen ? <CameraContent {...props} /> : null; }
