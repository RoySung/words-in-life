export const CAMERA_RATIO = 3 / 4;
const MAX_PHOTO_DIMENSION = 4096;

/** Match the centered object-fit: cover preview and its digital zoom. Never upscale. */
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

/** Capture the viewfinder's current frame without reconfiguring the camera.
 * Still-photo modes may expose a different field of view even at the same aspect ratio.
 */
export async function captureCameraPhoto(video: HTMLVideoElement,
  zoom: number, signal: AbortSignal): Promise<string | null> {
  if (signal.aborted || !video.videoWidth || !video.videoHeight || video.readyState < 2) return null;
  const frame = cropFrame(video, video.videoWidth, video.videoHeight, zoom);
  return signal.aborted ? null : frame.toDataURL('image/jpeg', .94);
}
