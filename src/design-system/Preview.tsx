/** Catalog fixture: production views, isolated memory state, no camera or recognition requests. */
import { useState } from 'react';
import { HomeView } from '../components/HomeView';
import { FavoritesView } from '../components/FavoritesView';
import { SceneView } from '../components/SceneView';
import { WordDetailModal } from '../components/WordDetailModal';
import { FlashcardQuiz } from '../components/FlashcardQuiz';
import { SAMPLE_SCENES } from '../data/sampleScenes';
import { generateDailyMissionsForDate } from '../data/dailyMissions';
import type { DailyMission, DetectedItem, SavedWord, SampleScene } from '../types';
import { ShutterButton } from './components';
import '../styles/application.css';

const initialScene = SAMPLE_SCENES[0];
const initialWords: SavedWord[] = initialScene.items.map(item => ({ ...item, savedAt: 0, imageUrl: initialScene.imageUrl, originalImageUrl: initialScene.imageUrl }));

export default function Preview() {
  const requested = new URLSearchParams(window.location.search).get('screen');
  const [screen, setScreen] = useState(requested || 'home');
  const [scene, setScene] = useState(initialScene);
  const [words, setWords] = useState(initialWords);
  const [detail, setDetail] = useState<DetectedItem | null>(requested === 'detail' ? initialScene.items[0] : null);
  const [quiz, setQuiz] = useState(requested === 'quiz');
  const [printing, setPrinting] = useState(requested === 'printing');
  const [notice, setNotice] = useState('');
  const [missions] = useState(() => generateDailyMissionsForDate('2026-10-26'));
  const [quest, setQuest] = useState<DailyMission | null>(null);
  const home = () => { setPrinting(false); setScreen('home'); };
  const print = (sample: SampleScene) => { setScene(sample); setWords(sample.items.map(item => ({ ...item, savedAt: 0, imageUrl: sample.imageUrl, originalImageUrl: sample.imageUrl }))); setScreen('home'); setPrinting(true); };
  const toggleSave = (item: DetectedItem) => setWords(previous => previous.some(w => w.id === item.id) ? previous.filter(w => w.id !== item.id) : [...previous, { ...item, savedAt: 0, imageUrl: scene.imageUrl, originalImageUrl: scene.imageUrl }]);
  const index = detail ? scene.items.findIndex(item => item.id === detail.id) : 0;
  return <div className="vs-theme words-in-life-app">
    {(screen === 'home' || screen === 'printing') ? <HomeView cameraEnabled={false} onToggleCamera={() => setNotice('展示模式不開啟鏡頭；請至應用程式體驗。')} onCapture={() => {}} onSelectFile={() => setNotice('展示模式請使用今日尋寶中的範例照片。')} onSelectSampleScene={print} onOpenFavorites={() => setScreen('collection')} savedWords={words} dailyMissions={missions} onStartQuest={setQuest} activeQuestTarget={quest} onCancelQuest={() => setQuest(null)} streakCount={0} printingImage={printing ? scene.imageUrl : undefined} onCancelPrinting={home} onPrintComplete={() => { /* Hold the developed print for inspection. */ }} /> : screen === 'scene' ? <SceneView result={{ ...scene, capturedAt: 0 }} onBack={home} onNewPhoto={home} onSelectItem={setDetail} savedWords={words} onToggleSave={toggleSave} /> : <FavoritesView savedWords={words} onBack={home} onSelectItem={setDetail} onRemoveWord={id => setWords(previous => previous.filter(w => w.id !== id))} onStartQuiz={() => setQuiz(true)} />}
    {printing && <div className="collection-capture"><button className="vs-button vs-button--primary" onClick={() => { setPrinting(false); setScreen('scene'); }}>查看示範辨識結果</button></div>}
    {!printing && screen !== 'home' && screen !== 'scene' && <nav className="collection-capture" aria-label="返回相機"><ShutterButton onClick={home} /></nav>}
    {detail && <WordDetailModal item={detail} imageUrl={scene.imageUrl} sceneTitle={scene.sceneTitle} onClose={() => setDetail(null)} isSaved={words.some(w => w.id === detail.id)} onToggleSave={() => toggleSave(detail)} index={index} total={scene.items.length} onPrevious={() => setDetail(scene.items[(index + scene.items.length - 1) % scene.items.length])} onNext={() => setDetail(scene.items[(index + 1) % scene.items.length])} />}
    {quiz && <FlashcardQuiz words={words} onClose={() => setQuiz(false)} />}
    {notice && <p role="status" style={{ position: 'fixed', bottom: 0, margin: 0, padding: 12, background: 'var(--vs-paper)', zIndex: 30 }}>{notice}</p>}
  </div>;
}
