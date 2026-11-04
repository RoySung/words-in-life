import { useEffect, useRef, useState } from 'react';

const CAMERA_RATIO = 3 / 4;

/** Own the stream for one visible camera surface; stale permission results are stopped. */
export function useLiveCamera(enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewBounds, setPreviewBounds] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  const [error, setError] = useState('');
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setPreviewBounds({ width, height });
    });
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    setStatus('starting');
    setError('');
    if (!visible || !enabled) return;
    setZoom(1);
    const ended = () => { if (!disposed) { setStatus('error'); setError('相機已中斷，請重新開啟或選擇照片。'); } };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
        const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1440 }, height: { ideal: 1920 }, aspectRatio: { ideal: CAMERA_RATIO } }, audio: false });
        if (disposed) { next.getTracks().forEach(t => t.stop()); return; }
        stream = next;
        next.getVideoTracks().forEach(t => t.addEventListener('ended', ended));
        if (video) { video.srcObject = next; await video.play(); }
      } catch (cause) {
        if (disposed) return;
        stream?.getTracks().forEach(t => t.stop());
        setStatus('error');
        setError(cause instanceof Error && cause.name === 'NotAllowedError'
          ? '相機權限尚未開啟。請允許瀏覽器使用相機，或直接選擇照片。'
          : '目前無法使用相機，你仍可以選擇照片開始探索。');
      }
    })();
    return () => {
      disposed = true;
      stream?.getTracks().forEach(t => { t.removeEventListener('ended', ended); t.stop(); });
      if (video) video.srcObject = null;
    };
  }, [attempt, visible, enabled]);
  const capture = () => {
    const video = videoRef.current;
    if (status !== 'ready' || !video?.videoWidth || video.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    // Match the centered object-fit: cover preview even when a camera ignores the preferred ratio.
    const sourceWidth = Math.min(video.videoWidth, video.videoHeight * CAMERA_RATIO) / zoom;
    const sourceHeight = sourceWidth / CAMERA_RATIO;
    canvas.width = Math.max(1, Math.round(sourceWidth));
    canvas.height = Math.max(1, Math.round(sourceHeight));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2,
      sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .88);
  };
  // Keep the capture frame at 3:4; zoom clips within this frame without enlarging its letterbox.
  const previewWidth = Math.min(previewBounds.width, previewBounds.height * CAMERA_RATIO);
  const previewStyle = { width: previewWidth, height: previewWidth / CAMERA_RATIO };
  const onReady = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    if (video.readyState >= 2) setStatus('ready');
  };
  return { videoRef, previewRef, previewStyle, zoom, setZoom, status, error, capture, retry: () => setAttempt(n => n + 1), onReady };
}
