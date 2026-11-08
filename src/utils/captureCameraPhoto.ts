import { loadImage } from './loadImage';

export const CAMERA_RATIO = 3 / 4;
const MAX_PHOTO_DIMENSION = 4096;
const PHOTO_TIMEOUT_MS = 3500;

type PhotoCapture = { takePhoto(): Promise<Blob> };
type PhotoCaptureConstructor = new (track: MediaStreamTrack) => PhotoCapture;

/** Apply the same centered 3:4 crop and digital zoom to either source. Never upscale. */
function cropFrame(source: CanvasImageSource, width: number, height: number, zoom: number) {
  const cropWidth = Math.min(width, height * CAMERA_RATIO) / zoom;
  const cropHeight = cropWidth / CAMERA_RATIO;
  const scale = Math.min(1, MAX_PHOTO_DIMENSION / cropHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('無法處理相機照片');
  context.drawImage(source, (width - cropWidth) / 2, (height - cropHeight) / 2,
    cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function captureCameraPhoto(video: HTMLVideoElement, track: MediaStreamTrack,
  zoom: number, signal: AbortSignal): Promise<string | null> {
  if (signal.aborted) return null;
  // Freeze the fallback before takePhoto can interrupt or reconfigure the preview stream.
  let frame = cropFrame(video, video.videoWidth, video.videoHeight, zoom);
  const ImageCapture = (window as Window & { ImageCapture?: PhotoCaptureConstructor }).ImageCapture;
  if (ImageCapture) {
    const decoding = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: () => void = () => {};
    const cancelled = new Promise<null>(resolve => { cancel = () => resolve(null); });
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const photo = (async () => {
        const blob = await new ImageCapture(track).takePhoto();
        if (decoding.signal.aborted || signal.aborted) return null;
        const url = URL.createObjectURL(blob);
        try {
          const image = await loadImage(url, decoding.signal);
          if (signal.aborted) return null;
          return cropFrame(image, image.naturalWidth, image.naturalHeight, zoom);
        } finally { URL.revokeObjectURL(url); }
      })();
      const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), PHOTO_TIMEOUT_MS); });
      const still = await Promise.race([photo, timeout, cancelled]);
      // Some devices expose takePhoto but return a smaller image than the preview.
      if (still && still.width >= frame.width && still.height >= frame.height) frame = still;
    } catch {
      // Unsupported devices, capture errors and undecodable images use the frozen preview.
    } finally {
      clearTimeout(timer);
      decoding.abort();
      signal.removeEventListener('abort', cancel);
    }
  }
  return signal.aborted ? null : frame.toDataURL('image/jpeg', .94);
}
