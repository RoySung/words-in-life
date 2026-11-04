import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import type { DetectedItem } from '../types';
import { PhotoImage, type PhotoUrls } from '../hooks/usePhotoUrl';
import { useDialog } from '../hooks/useDialog';
import { Button, IconButton } from '../design-system/components';
import { createWordShareImage, downloadWordImage } from '../utils/wordShare';
import { openWordShare, closeWordShare } from '../utils/wordShareMotion';
import './word-share.css';

export function WordShareModal({ item, photoUrls, imageUrl, onClose, originPhoto }: {
  originPhoto?: HTMLImageElement | null; item: DetectedItem; photoUrls?: PhotoUrls; imageUrl?: string; onClose: () => void;
}) {
  const motionCleanup = useRef<(() => void) | undefined>(undefined);
  const closing = useRef(false);
  const requestClose = async () => {
    if (closing.current) return;
    closing.current = true;
    motionCleanup.current?.();
    if (dialog.current) await closeWordShare(dialog.current, originPhoto);
    if (active.current) onClose();
  };
  const dialog = useDialog(() => { void requestClose(); });
  useEffect(() => () => motionCleanup.current?.(), []);
  const [result, setResult] = useState<{ file: File; url: string }>();
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const active = useRef(true);
  const started = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (result || error) return;
    const timer = window.setTimeout(() => setError('照片載入逾時，請關閉後重試。'), 20_000);
    return () => window.clearTimeout(timer);
  }, [result, error]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  const generate = async (photo: HTMLImageElement) => {
    if (started.current) return;
    started.current = true;
    try {
      const blob = await createWordShareImage(item, photo);
      if (!active.current) return;
      const name = item.word.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'word';
      const file = new File([blob], `${name}-words-in-life.png`, { type: 'image/png' });
      setResult({ file, url: URL.createObjectURL(blob) });
    } catch { if (active.current) setError('無法產生分享圖片，請關閉後重試。'); }
  };
  const share = async () => {
    if (!result || sharing) return;
    setError('');
    if (!navigator.canShare?.({ files: [result.file] })) {
      downloadWordImage(result.file);
      return;
    }
    setSharing(true);
    try { await navigator.share({ files: [result.file], title: `${item.word} · Words in Life` }); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('分享未完成，你可以儲存圖片後再傳送。'); }
    finally { if (active.current) setSharing(false); }
  };
  return <dialog ref={dialog} className={`word-share-dialog vs-surface-dark ${!error && !previewReady ? 'is-preparing' : ''}`} aria-label="分享單字">
    <header><h2>分享單字</h2><IconButton label="關閉分享" onClick={() => void requestClose()}><X /></IconButton></header>
    <p className="word-share-hint">預覽你的單字卡片</p>
    {!result && <div className="word-share-source" aria-hidden="true"><PhotoImage photo={item.crop || item.photo} urls={photoUrls} src={item.stickerUrl} fallbackPhoto={item.photo} fallbackSrc={item.originalImageUrl || imageUrl} crossOrigin="anonymous" alt="" onLoad={event => { void generate(event.currentTarget); }} /></div>}
    {result ? <img className="word-share-preview" onLoad={event => { setPreviewReady(true); if (dialog.current) motionCleanup.current = openWordShare(dialog.current, event.currentTarget, originPhoto); }} src={result.url} alt={`${item.word}，${item.chinese}，分享圖片預覽`} /> : !error && <p role="status">正在產生分享圖片…</p>}
    {error && <p className="word-share-error" role="alert">{error}</p>}
    <footer><Button variant="secondary" disabled={!result || sharing} onClick={() => { if (result) { downloadWordImage(result.file); } }}><Download />儲存圖片</Button><Button disabled={!result} loading={sharing} onClick={() => void share()}><Share2 />分享圖片</Button></footer>
  </dialog>;
}
