import { PhotoImage, type PhotoUrls } from '../hooks/usePhotoUrl';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Volume2, Check, RotateCcw, Image } from 'lucide-react';
import { SavedWord } from '../types';
import { speakEnglish } from '../utils/audio';
import { Button, IconButton, Progress } from '../design-system/components';
import { useDialog } from '../hooks/useDialog';

function shuffle<T,>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function makeQuestions(words: SavedWord[]) {
  return shuffle(words).slice(0, 5).map(word => {
    const unique = new Map(words.filter(other => other.word.trim().toLowerCase() !== word.word.trim().toLowerCase()).map(other => [other.word.trim().toLowerCase(), other.word]));
    return { word, options: shuffle([word.word, ...shuffle([...unique.values()]).slice(0, 3)]) };
  });
}
export function FlashcardQuiz({ words: sourceWords, onClose, onReview, photoUrls }: { photoUrls?: PhotoUrls; words: SavedWord[]; onClose: () => void; onReview?: (id: string, remembered: boolean) => Promise<boolean> }) {
  const dialog = useDialog(onClose);
  const [questions, setQuestions] = useState(() => makeQuestions(sourceWords));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [missedWords, setMissedWords] = useState<SavedWord[]>([]);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const savingRef = useRef(false);
  useEffect(() => {
    if (index >= questions.length) {
      dialog.current?.scrollTo({ top: 0 });
      resultHeading.current?.focus({ preventScroll: true });
    }
  }, [index, questions.length, dialog]);
  const question = questions[index];
  const word = question?.word;
  const submit = async (answer: string) => {
    if (!word || savingRef.current || saved) return;
    savingRef.current = true;
    setSelected(answer); setSaving(true); setSaveError('');
    window.speechSynthesis?.cancel();
    try {
      const success = onReview ? await onReview(word.id, answer === word.word) : true;
      if (!success) throw new Error('save failed');
      setSaved(true);
      if (answer === word.word) setCorrectCount(n => n + 1);
      else setMissedWords(items => [...items, word]);
    } catch {
      setSaveError('複習紀錄尚未儲存，請重試。');
    } finally {
      setSaving(false); savingRef.current = false;
    }
  };
  return <dialog ref={dialog} className={`word-dialog vs-surface-dark quiz-dialog ${selected !== null ? 'quiz-has-answer' : ''}`} aria-label="單字選擇題測驗">
    <header className="page-header"><IconButton label="結束複習" onClick={onClose}><ChevronLeft /></IconButton><h1>單字選擇題</h1><span>{Math.min(index + 1, questions.length)} / {questions.length}</span></header>
    {word ? <main>
      <Progress label={`已完成 ${index + (saved ? 1 : 0)}／${questions.length} 題`} value={(index + (saved ? 1 : 0)) / questions.length * 100} />
      <article className={`quiz-card quiz-question ${selected !== null ? 'is-answered' : ''}`} aria-busy={saving}>
        {word.crop || word.photo || word.stickerUrl || word.imageUrl ? <PhotoImage photo={word.crop || word.photo} urls={photoUrls} src={word.stickerUrl} fallbackPhoto={word.photo} fallbackSrc={word.originalImageUrl || word.imageUrl} alt="待辨識的物品照片" /> : <div className="quiz-photo-missing"><Image /><p>依中文提示選出英文</p></div>}
        <h2>{word.chinese}</h2><p>選擇正確的英文單字</p>
      </article>
      {question.options.length === 1 && <p>目前只有一個不同的單字，收藏更多單字後就會有更多選項。</p>}
      <div className="quiz-options" role="group" aria-label="單字選項">{question.options.map(option => <Button key={option} variant="secondary" disabled={selected !== null} onClick={() => void submit(option)} className={selected !== null ? option === word.word ? 'quiz-option-correct' : option === selected ? 'quiz-option-wrong' : '' : ''}><span lang="en">{option}</span>{selected !== null && option === word.word && <Check aria-label="正確答案" />}</Button>)}</div>
      {selected !== null && <div className="quiz-feedback" role="status"><p>{selected === word.word ? '答對了！' : '再記一次，正確答案是：'}</p><div className="quiz-word-heading"><h2 lang="en">{word.word}</h2><IconButton label="播放單字發音" onClick={() => speakEnglish(word.word)}><Volume2 /></IconButton></div><p>{word.phonetic}</p><p>{word.definition}</p><details key={word.id} className="quiz-example"><summary>查看例句</summary><div className="quiz-example-sentence"><p lang="en">{word.exampleEn}</p>{word.exampleEn && <IconButton label="播放英文例句發音" onClick={() => speakEnglish(word.exampleEn)}><Volume2 /></IconButton>}</div><p>{word.exampleZh}</p></details></div>}
      {saveError && <p role="alert">{saveError}</p>}
      {saveError && selected !== null && <Button disabled={saving} onClick={() => void submit(selected)}>重試儲存</Button>}
      {saved && <footer className="quiz-footer"><Button onClick={() => { setIndex(n => n + 1); setSelected(null); setSaved(false); setSaveError(''); }}>{index === questions.length - 1 ? '查看結果' : '下一題'}</Button></footer>}
    </main> : <main className={`quiz-complete quiz-result ${questions.length > 0 && correctCount === questions.length ? 'is-perfect' : ''}`}>
      {questions.length > 0 && correctCount === questions.length && <div className="quiz-confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <span key={i} style={{ left: `${5 + i * 6}%`, animationDelay: `${(i % 5) * 0.06}s`, rotate: `${i * 31}deg` }} />)}</div>}
      <div className="quiz-result-seal" aria-hidden="true"><Check /></div>
      <h2 ref={resultHeading} tabIndex={-1}>{questions.length === 0 ? '還沒有可測驗的單字' : correctCount === questions.length ? '全部答對！' : '本輪測驗完成'}</h2>
      <div className="quiz-result-score" aria-label={`${questions.length} 題中答對 ${correctCount} 題`}><strong>{correctCount}</strong><span>／ {questions.length}</span><p>題答對</p></div>
      <p className="quiz-result-message">{questions.length === 0 ? '先收藏幾個生活單字，再來練習吧。' : correctCount === questions.length ? '這些生活單字，你都記住了。' : '又讓生活單字變熟悉了一點。'}</p>
      {missedWords.length > 0 && <section className="quiz-result-review" aria-label="待複習單字"><h3>再練一次的單字 · {missedWords.length} 個</h3>{missedWords.map(item => <div className="quiz-result-word" key={item.id}><div><strong lang="en">{item.word}</strong><p>{item.chinese}</p></div><IconButton label={`播放 ${item.word} 發音`} onClick={() => speakEnglish(item.word)}><Volume2 /></IconButton></div>)}</section>}
      <div className="quiz-result-actions">{questions.length > 0 && <Button onClick={() => { window.speechSynthesis?.cancel(); setQuestions(makeQuestions(sourceWords)); setIndex(0); setCorrectCount(0); setMissedWords([]); setSelected(null); setSaved(false); setSaveError(''); dialog.current?.scrollTo({ top: 0 }); }}><RotateCcw />再挑戰 {Math.min(5, sourceWords.length)} 題</Button>}<Button variant="secondary" onClick={onClose}>回到單字本</Button></div>
    </main>}
  </dialog>;
}
