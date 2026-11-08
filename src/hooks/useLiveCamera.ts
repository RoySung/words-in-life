import { useEffect, useRef, useState } from 'react';
import { CAMERA_RATIO, captureCameraPhoto } from '../utils/captureCameraPhoto';
import { standardRearCameraId } from '../utils/cameraDevice';

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
  const [capturing, setCapturing] = useState(false);
  const captureRef = useRef<AbortController | null>(null);
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
    setCapturing(false);
    if (!visible || !enabled) return;
    setZoom(1);
    const ended = () => { if (!disposed) { setStatus('error'); setError('相機已中斷，請重新開啟或選擇照片。'); } };
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
        const constraints = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 2560 }, aspectRatio: { ideal: CAMERA_RATIO } };
        let next = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        if (disposed) { next.getTracks().forEach(t => t.stop()); return; }
        stream = next;
        // Permission reveals device labels. Choose one physical rear lens before displaying
        // the preview so a virtual multi-lens camera cannot auto-switch for close-up focus.
        let deviceId: string | undefined;
        try { deviceId = standardRearCameraId(await navigator.mediaDevices.enumerateDevices()); }
        catch { /* Device discovery is optional; retain the working default stream. */ }
        if (disposed) return;
        if (deviceId && next.getVideoTracks()[0]?.getSettings().deviceId !== deviceId) {
          next.getTracks().forEach(t => t.stop());
          try {
            next = await navigator.mediaDevices.getUserMedia({ video: { ...constraints, deviceId: { exact: deviceId } }, audio: false });
          } catch {
            if (disposed) return;
            next = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
          }
          if (disposed) { next.getTracks().forEach(t => t.stop()); return; }
          stream = next;
        }
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
      captureRef.current?.abort();
      captureRef.current = null;
      stream?.getTracks().forEach(t => { t.removeEventListener('ended', ended); t.stop(); });
      if (video) video.srcObject = null;
    };
  }, [attempt, visible, enabled]);
  const capture = async () => {
    const video = videoRef.current;
    const track = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!enabled || document.hidden || captureRef.current || status !== 'ready' || !video?.videoWidth
      || video.readyState < 2 || track?.readyState !== 'live') return null;
    const controller = new AbortController();
    captureRef.current = controller;
    setCapturing(true);
    try {
      const image = await captureCameraPhoto(video, zoom, controller.signal);
      return !controller.signal.aborted && track.readyState === 'live' ? image : null;
    } catch {
      return null;
    } finally {
      if (captureRef.current === controller) {
        captureRef.current = null;
        setCapturing(false);
      }
    }
  };
  // Keep the capture frame at 3:4; zoom clips within this frame without enlarging its letterbox.
  const previewWidth = Math.min(previewBounds.width, previewBounds.height * CAMERA_RATIO);
  const previewStyle = { width: previewWidth, height: previewWidth / CAMERA_RATIO };
  const onReady = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    if (video.readyState >= 2) setStatus('ready');
  };
  return { videoRef, previewRef, previewStyle, zoom, setZoom, status, error, capturing, capture, retry: () => setAttempt(n => n + 1), onReady };
}
