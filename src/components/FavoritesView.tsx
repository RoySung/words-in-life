import { PhotoImage, type PhotoUrls } from '../hooks/usePhotoUrl';
import React, { useState } from 'react';
import { LayoutGrid, List, Search, Volume2, Trash2, Image, BookOpen } from 'lucide-react';
import { SavedWord, DetectedItem } from '../types';
import { speakEnglish } from '../utils/audio';
import { Button, Chip, IconButton, SearchField } from '../design-system/components';
import { WORD_CATEGORIES, wordCategory } from '../utils/wordCategory';
import { PhotoSourceModal } from './PhotoSourceModal';
interface FavoritesViewProps { photoUrls?: PhotoUrls;
  savedWords: SavedWord[]; onBack: () => void; onSelectItem: (item: DetectedItem) => void;
  onRemoveWord: (wordId: string) => void; onStartQuiz: () => void;
}
export function FavoritesView({ photoUrls, savedWords, onBack, onSelectItem, onRemoveWord, onStartQuiz }: FavoritesViewProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [list, setList] = useState(false);
  const [search, setSearch] = useState(false);
  const [source, setSource] = useState<SavedWord | null>(null);
  const filtered = savedWords.filter(w => (category === '全部' || wordCategory(w.word) === category) && `${w.word} ${w.chinese}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="app-page collection-page">
    <header className="page-header"><h1>我的單字</h1><div className="action-group"><IconButton label="搜尋單字" aria-expanded={search} onClick={() => { if (search) setQuery(''); setSearch(!search); }}><Search /></IconButton><IconButton label={list ? '切換網格檢視' : '切換列表檢視'} aria-pressed={list} onClick={() => setList(!list)}>{list ? <LayoutGrid /> : <List />}</IconButton></div></header>
    {search && <SearchField autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋英文或中文…" />}
    <div className="category-strip" aria-label="單字分類">{WORD_CATEGORIES.map(c => <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>{c}<span>{savedWords.filter(w => c === '全部' || wordCategory(w.word) === c).length}</span></Chip>)}</div>
    <main>
      {!filtered.length ? <div className="empty-state"><BookOpen /><h2>{savedWords.length ? '找不到這個單字' : '把日常，收進單字本'}</h2><p>{savedWords.length ? '試試其他關鍵字或分類。' : '拍下一張照片，收藏你想記住的英文。'}</p><Button onClick={savedWords.length ? () => { setQuery(''); setCategory('全部'); } : onBack}>{savedWords.length ? '顯示全部單字' : '開始探索'}</Button></div> :
      <div className={`word-gallery ${list ? 'word-gallery--list' : ''}`}>{filtered.map(w => <article className="collection-card" key={w.id}>
        <button className="collection-open" onClick={() => onSelectItem({ ...w, position: w.position || { x: 50, y: 50 } })} aria-label={`查看 ${w.word} ${w.chinese}`}>
          {w.crop || w.photo || w.stickerUrl || w.imageUrl ? <PhotoImage photo={w.crop || w.photo} urls={photoUrls} src={w.stickerUrl || w.imageUrl} alt={w.chinese} loading="lazy" /> : <div className="photo-placeholder"><Image /></div>}
          <div><h2 lang="en">{w.word}</h2><p>{w.chinese}</p></div>
        </button>
        <div className="collection-actions"><IconButton label={`播放 ${w.word} 發音`} onClick={() => speakEnglish(w.word)}><Volume2 /></IconButton><IconButton label={`查看 ${w.word} 原圖`} onClick={() => setSource(w)} disabled={!w.photo && !w.originalImageUrl && !w.imageUrl}><Image /></IconButton><IconButton label={`移除 ${w.word}`} onClick={() => onRemoveWord(w.id)}><Trash2 /></IconButton></div>
      </article>)}</div>}
      {savedWords.length > 0 && <div className="review-link"><p>留一點時間，讓新單字變熟悉。</p><Button variant="secondary" onClick={onStartQuiz}><BookOpen />開始翻卡複習</Button></div>}
    </main>
    {source && <PhotoSourceModal photo={source.photo} photoUrls={photoUrls} isOpen onClose={() => setSource(null)} originalImageUrl={source.originalImageUrl || source.imageUrl || ''} stickerUrl={source.stickerUrl} word={source.word} chinese={source.chinese} emoji={source.emoji} position={source.position} sceneTitle={source.sceneTitle} />}
  </div>;
}
