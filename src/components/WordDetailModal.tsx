import { type PhotoUrls } from '../hooks/usePhotoUrl';
import React, { useState, useId, useRef } from 'react';
import { ChevronLeft, Volume2, Eye, ChevronDown, Copy, ExternalLink, Share2 } from 'lucide-react';
import { DetectedItem } from '../types';
import { Button, IconButton, Polaroid, Tag } from '../design-system/components';
import { Bookmark, ChevronRight } from 'lucide-react';
import { WordShareModal } from './WordShareModal';
import { PhotoSourceModal } from './PhotoSourceModal';
import { useDialog } from '../hooks/useDialog';
import { wordCategory } from '../utils/wordCategory';
import { speakEnglish, playSfx } from '../utils/audio';

interface WordDetailModalProps {
  photoUrls?: PhotoUrls;
  item: DetectedItem;
  storageError?: string;
  imageUrl?: string;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  sceneTitle?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  index?: number;
  total?: number;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  item, storageError, photoUrls,
  imageUrl,
  onClose,
  isSaved,
  onToggleSave,
  sceneTitle, onPrevious, onNext, index = 0, total = 1,
}) => {
  const [copyStatus, setCopyStatus] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  React.useEffect(() => { setCopyStatus(''); }, [item.word]);
  const handleCopyWord = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(item.word);
      setCopyStatus('已複製單字');
    } catch {
      setCopyStatus('無法複製，請長按或選取單字後複製');
    } finally {
      setIsCopying(false);
    }
  };
  const query = encodeURIComponent(item.word);
  const dictionaries = [
    { name: 'Cambridge', url: `https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${query}` },
    { name: 'Oxford', url: `https://www.oxfordlearnersdictionaries.com/definition/english/${query}` },
    { name: '韋氏字典', url: `https://www.merriam-webster.com/dictionary/${query}` },
    { name: 'Google 翻譯', url: `https://translate.google.com/?sl=en&tl=zh-TW&text=${query}&op=translate` },
  ];
  const moreId = useId();
  const [more, setMore] = useState(false);
  const dialogRef = useDialog(onClose);
  React.useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingExample, setIsPlayingExample] = useState(false);
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const shareOrigin = useRef<HTMLImageElement | null>(null);

  const handlePlayWord = async (slow = isSlowMode) => {
    setIsPlayingAudio(true);
    playSfx('pop');
    await speakEnglish(item.word, slow ? 0.7 : 0.95);
    setIsPlayingAudio(false);
  };

  const handlePlayExample = async () => {
    setIsPlayingExample(true);
    playSfx('pop');
    await speakEnglish(item.exampleEn, 0.9);
    setIsPlayingExample(false);
  };

  const source = item.originalImageUrl || imageUrl || '';
  return <dialog ref={dialogRef} className={`word-dialog vs-surface-dark word-detail-dialog ${more ? "is-expanded" : ""}`} aria-label={`${item.word} 單字詳情`}>
    <header className="page-header"><IconButton label="關閉單字詳情" onClick={onClose}><ChevronLeft /></IconButton><span /><IconButton label={isSaved ? '移除收藏' : '收藏單字'} aria-pressed={isSaved} onClick={onToggleSave}><Bookmark fill={isSaved ? 'currentColor' : 'none'} /></IconButton></header>
    {storageError && <p role="alert" className="vs-error">{storageError}</p>}
    <main><article className="word-detail-paper"><Polaroid photo={item.crop || item.photo} urls={photoUrls} src={item.stickerUrl} fallbackPhoto={item.photo} fallbackSrc={source} alt={item.chinese} taped className="detail-polaroid" />
      <div className="word-detail-content">
      <div className="detail-word"><h1 lang="en">{item.word}</h1><div className="word-tools"><IconButton label="播放單字發音" disabled={isPlayingAudio} onClick={() => handlePlayWord()}><Volume2 /></IconButton><IconButton label="分享單字" onClick={() => { shareOrigin.current = dialogRef.current?.querySelector<HTMLImageElement>('.detail-polaroid img') ?? null; setIsShareOpen(true); }}><Share2 /></IconButton><IconButton label="複製單字" disabled={isCopying} onClick={handleCopyWord}><Copy /></IconButton></div></div>
      <span className="word-copy-status" role="status">{copyStatus}</span>
      <p className="phonetic">{item.phonetic}</p><p className="translation">{item.chinese}</p><div className="action-group"><Tag>{item.partOfSpeech}</Tag><Tag tone="blue">{wordCategory(item.word)}</Tag></div>
      <div className="word-example"><div><p lang="en">{item.exampleEn}</p><IconButton label="播放例句" disabled={isPlayingExample} onClick={handlePlayExample}><Volume2 /></IconButton></div><p>{item.exampleZh}</p></div>
      <section className="word-more">
        <Button className="word-more-toggle" variant="ghost" aria-expanded={more} aria-controls={moreId} onClick={() => setMore(!more)}>更多用法與發音<ChevronDown className={more ? 'is-open' : ''} /></Button>
        <div id={moreId} hidden={!more}>
          <p>{item.definition}</p>
          <div className="collocations">{item.collocations?.map(c => <Button key={c} variant="secondary" onClick={() => speakEnglish(c)}>{c}<Volume2 /></Button>)}</div>
          <div className="word-speed"><span>發音速度</span><Button variant="ghost" aria-pressed={!isSlowMode} disabled={isPlayingAudio} onClick={() => { setIsSlowMode(false); handlePlayWord(false); }}>正常</Button><Button variant="ghost" aria-pressed={isSlowMode} disabled={isPlayingAudio} onClick={() => { setIsSlowMode(true); handlePlayWord(true); }}>慢速</Button></div>
        </div>
      </section>
      <nav className="word-dictionaries" aria-label="字典與翻譯"><h3>字典與翻譯</h3><div>{dictionaries.map(dictionary => <a key={dictionary.name} href={dictionary.url} target="_blank" rel="noopener noreferrer" aria-label={`${dictionary.name}（開啟新分頁）`}>{dictionary.name}<ExternalLink size={16} /></a>)}</div></nav>
      {(source || item.photo) && <Button className="source-button" variant="ghost" onClick={() => setIsPhotoSourceOpen(true)}><Eye />查看拍攝原圖</Button>}
    </div></article></main>
    <footer className="detail-pagination"><IconButton label="上一個單字" disabled={!onPrevious} onClick={onPrevious}><ChevronLeft /></IconButton><span>{index + 1} / {total}</span><IconButton label="下一個單字" disabled={!onNext} onClick={onNext}><ChevronRight /></IconButton></footer>
    {isShareOpen && <WordShareModal originPhoto={shareOrigin.current} key={item.id} item={item} photoUrls={photoUrls} imageUrl={imageUrl} onClose={() => setIsShareOpen(false)} />}
    {isPhotoSourceOpen && <PhotoSourceModal photo={item.photo} photoUrls={photoUrls} isOpen onClose={() => setIsPhotoSourceOpen(false)} originalImageUrl={source} word={item.word} chinese={item.chinese} emoji={item.emoji} position={item.position} sceneTitle={sceneTitle} />}
  </dialog>;
};
