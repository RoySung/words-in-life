import { usePhotoUrl, type PhotoUrls } from '../hooks/usePhotoUrl';
import React, { useState } from 'react';
import { ChevronLeft, Volume2, Mic, MicOff, Eye, MoreVertical } from 'lucide-react';
import { DetectedItem } from '../types';
import { Button, IconButton, Polaroid, Tag } from '../design-system/components';
import { Bookmark, ChevronRight } from 'lucide-react';
import { PhotoSourceModal } from './PhotoSourceModal';
import { useDialog } from '../hooks/useDialog';
import { wordCategory } from '../utils/wordCategory';
import { speakEnglish, playSfx, recordAndEvaluateSpeech } from '../utils/audio';

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
  const [more, setMore] = useState(false);
  const dialogRef = useDialog(onClose);
  React.useEffect(() => () => { speechRecognizerRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingExample, setIsPlayingExample] = useState(false);
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false);

  // Speech practice state
  const [isRecording, setIsRecording] = useState(false);
  const [speechEvaluation, setSpeechEvaluation] = useState<{
    spokenText: string;
    score: number;
    feedback: string;
  } | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechRecognizerRef = React.useRef<{ stop: () => void } | null>(null);

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

  const handleToggleSlow = () => {
    const nextSlow = !isSlowMode;
    setIsSlowMode(nextSlow);
    handlePlayWord(nextSlow);
  };

  const handleStartSpeechPractice = () => {
    setSpeechError(null);
    setSpeechEvaluation(null);

    const recognizer = recordAndEvaluateSpeech(
      item.word,
      () => {
        setIsRecording(true);
      },
      (res) => {
        setIsRecording(false);
        setSpeechEvaluation({
          spokenText: res.recognizedText,
          score: res.score,
          feedback: res.feedback,
        });
      },
      (err) => {
        setIsRecording(false);
        setSpeechError(err);
      }
    );

    speechRecognizerRef.current = recognizer;
  };

  const handleStopSpeechPractice = () => {
    if (speechRecognizerRef.current) {
      speechRecognizerRef.current.stop();
      setIsRecording(false);
    }
  };

  const source = item.originalImageUrl || imageUrl || '';
  const preview = usePhotoUrl(item.crop || item.photo, item.stickerUrl || source, photoUrls);
  return <dialog ref={dialogRef} className={`word-dialog word-detail-dialog ${more ? "is-expanded" : ""}`} aria-label={`${item.word} 單字詳情`}>
    <header className="page-header"><IconButton label="關閉單字詳情" onClick={onClose}><ChevronLeft /></IconButton><span /><IconButton label={isSaved ? '移除收藏' : '收藏單字'} aria-pressed={isSaved} onClick={onToggleSave}><Bookmark fill={isSaved ? 'currentColor' : 'none'} /></IconButton></header>
    {storageError && <p role="alert" className="vs-error">{storageError}</p>}
    <main><Polaroid src={preview} alt={item.chinese} taped className="detail-polaroid">
      <div className="detail-word"><h1 lang="en">{item.word}</h1><IconButton label="播放單字發音" disabled={isPlayingAudio} onClick={() => handlePlayWord()}><Volume2 /></IconButton><IconButton className="word-menu" label="更多用法與發音練習" aria-expanded={more} onClick={() => setMore(!more)}><MoreVertical /></IconButton></div>
      <p className="phonetic">{item.phonetic}</p><p className="translation">{item.chinese}</p><div className="action-group"><Tag>{item.partOfSpeech}</Tag><Tag tone="blue">{wordCategory(item.word)}</Tag></div>
      <div className="word-example"><div><p lang="en">{item.exampleEn}</p><IconButton label="播放例句" disabled={isPlayingExample} onClick={handlePlayExample}><Volume2 /></IconButton></div><p>{item.exampleZh}</p></div>
      {more && <section className="word-more"><h2>更多用法與發音練習</h2><p>{item.definition}</p><div className="collocations">{item.collocations?.map(c => <Button key={c} variant="secondary" onClick={() => speakEnglish(c)}>{c}<Volume2 /></Button>)}</div><Button variant="ghost" aria-pressed={isSlowMode} onClick={handleToggleSlow}>{isSlowMode ? '切換正常語速' : '慢速聆聽'}</Button><Button onClick={isRecording ? handleStopSpeechPractice : handleStartSpeechPractice}>{isRecording ? <MicOff /> : <Mic />}{isRecording ? '停止錄音' : '練習唸出這個單字'}</Button><div role="status">{isRecording && <p>正在聆聽你的發音…</p>}{speechEvaluation && <p>「{speechEvaluation.spokenText}」· {speechEvaluation.score}% 相似度<br />{speechEvaluation.feedback}</p>}{speechError && <p className="vs-error">{speechError}</p>}</div></section>}
      {more && (source || item.photo) && <Button className="source-button" variant="ghost" onClick={() => setIsPhotoSourceOpen(true)}><Eye />查看拍攝原圖</Button>}
    </Polaroid></main>
    <footer className="detail-pagination"><IconButton label="上一個單字" disabled={!onPrevious} onClick={onPrevious}><ChevronLeft /></IconButton><span>{index + 1} / {total}</span><IconButton label="下一個單字" disabled={!onNext} onClick={onNext}><ChevronRight /></IconButton></footer>
    {isPhotoSourceOpen && <PhotoSourceModal photo={item.photo} photoUrls={photoUrls} isOpen onClose={() => setIsPhotoSourceOpen(false)} originalImageUrl={source} word={item.word} chinese={item.chinese} emoji={item.emoji} position={item.position} sceneTitle={sceneTitle} />}
  </dialog>;
};
