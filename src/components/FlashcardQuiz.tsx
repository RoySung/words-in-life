import { PhotoImage, type PhotoUrls } from '../hooks/usePhotoUrl';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Volume2, Check, RotateCcw, Image } from 'lucide-react';
import { SavedWord } from '../types';
import { speakEnglish } from '../utils/audio';
import { Button, IconButton, Progress } from '../design-system/components';
import { useDialog } from '../hooks/useDialog';
export function FlashcardQuiz({ words: sourceWords, onClose, onReview, photoUrls }: { photoUrls?: PhotoUrls; words: SavedWord[]; onClose: () => void; onReview?: (id: string, remembered: boolean) => Promise<boolean> }) {
  const dialog = useDialog(onClose);
  const [words] = useState(sourceWords);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState(0);
  const [advancing, setAdvancing] = useState<boolean | null>(null);
  const advancingRef = useRef(false);
  const word = words[index];
  const nextWord = words[index + 1];
  const busy = saving || advancing !== null;
  useEffect(() => {
    if (advancing === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      if (advancing) setMastered(n => n + 1);
      setFlipped(false);
      setIndex(n => n + 1);
      setAdvancing(null);
      advancingRef.current = false;
    }, reduced || !nextWord ? 0 : 620);
    return () => window.clearTimeout(timer);
  }, [advancing, nextWord]);
  const next = async (remembered: boolean) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    window.speechSynthesis?.cancel();
    setSaving(true); setSaveError('');
    const saved = onReview ? await onReview(word.id, remembered) : true;
    setSaving(false);
    if (!saved) { setSaveError('複習紀錄尚未儲存，請重試。'); advancingRef.current = false; return; }
    setAdvancing(remembered);
  };
  return <dialog ref={dialog} className="word-dialog vs-surface-dark quiz-dialog" aria-label="單字翻卡測驗"><header className="page-header"><IconButton label="結束複習" onClick={onClose}><ChevronLeft /></IconButton><h1>單字翻卡</h1><span>{Math.min(index + 1, words.length)} / {words.length}</span></header>
    {saveError && <p role="alert">{saveError}</p>}
    {word ? <main><Progress label="複習進度" value={index / words.length * 100} /><article className={`quiz-card ${busy ? "is-advancing" : ""}`} aria-label="照片翻卡" aria-busy={busy}>
      {nextWord && <div className="quiz-next-card quiz-face quiz-face--front" aria-hidden="true" inert>{nextWord.crop || nextWord.photo || nextWord.stickerUrl || nextWord.imageUrl ? <PhotoImage photo={nextWord.crop || nextWord.photo} urls={photoUrls} src={nextWord.stickerUrl || nextWord.imageUrl} alt="" /> : <div className="quiz-photo-missing"><Image /></div>}<span className="quiz-face-hint">看照片，想想它的英文。<br />點一下翻卡看解答</span></div>}
      <div key={word.id} className={`quiz-card-turn ${flipped ? 'is-flipped' : ''}`}>
        <div className="quiz-face quiz-face--front" aria-hidden={flipped} inert={flipped}>
          {word.crop || word.photo || word.stickerUrl || word.imageUrl ? <PhotoImage photo={word.crop || word.photo} urls={photoUrls} src={word.stickerUrl || word.imageUrl} alt="待辨識的物品照片" /> : <div className="quiz-photo-missing"><Image /><p>這個單字沒有照片</p></div>}
          <span className="quiz-face-hint">看照片，想想它的英文。<br />點一下翻卡看解答</span>
          <button type="button" className="quiz-flip-trigger" disabled={busy} onClick={() => setFlipped(true)} aria-label="翻卡查看解答" aria-pressed={false} />
        </div>
        <div className="quiz-face quiz-face--back" aria-hidden={!flipped} inert={!flipped}>
          <div className="quiz-answer"><div className="quiz-word-heading"><h2 lang="en">{word.word}</h2>{flipped && <IconButton className="quiz-speak" disabled={busy} label="播放單字發音" onClick={() => speakEnglish(word.word)}><Volume2 /></IconButton>}</div><p className="phonetic">{word.phonetic}</p><h3>{word.chinese}</h3><p className="quiz-definition">{word.definition}</p><div className="word-example"><p lang="en">{word.exampleEn}</p><p>{word.exampleZh}</p></div></div>
          <span className="quiz-face-hint">點一下，翻回照片</span>
          <button type="button" className="quiz-flip-trigger" disabled={busy} onClick={() => setFlipped(false)} aria-label="翻回照片" aria-pressed />
        </div>
      </div>
    </article><div className="quiz-actions"><Button variant="secondary" disabled={busy} onClick={() => next(false)}>還不熟</Button><Button disabled={busy} onClick={() => next(true)}><Check />記住了</Button></div></main> : <main className="quiz-complete"><Check /><h2>今天又多記住了一點。</h2><p>{words.length} 個單字中，你記住了 {mastered} 個。</p><Button onClick={() => { setIndex(0); setMastered(0); }}><RotateCcw />再複習一次</Button><Button variant="secondary" onClick={onClose}>回到單字本</Button></main>}
  </dialog>;
}
