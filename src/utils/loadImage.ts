/** Bounded image decoding with cancellation, shared by upload compression and cropping. */
export function loadImage(source: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
    const fail = (cause: Error) => { cleanup(); image.src = ''; reject(cause); };
    const abort = () => fail(new DOMException('Image decoding cancelled', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('照片載入逾時，請重試。')), 10000);
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => fail(new Error('無法讀取這張照片，請選擇 JPEG、PNG 或 WebP 圖片。'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    image.src = source;
  });
}
