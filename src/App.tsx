import React, { useState, useEffect } from 'react';
import { SettingsView } from './components/SettingsView';
import { readGeminiKey, saveGeminiKey } from './utils/geminiSettings';
import { HomeView } from './components/HomeView';
import { SceneView } from './components/SceneView';
import { WordDetailModal } from './components/WordDetailModal';
import { FavoritesView } from './components/FavoritesView';
import { FlashcardQuiz } from './components/FlashcardQuiz';
import { MissionSuccessModal } from './components/MissionSuccessModal';
import { PhotoSourceModal } from './components/PhotoSourceModal';
import { RecognitionFailureView } from './components/RecognitionFailureView';
import { AnalysisResult, DailyMission, DetectedItem, SampleScene } from './types';
import { createServices } from './createServices';
import { useLibrary } from './hooks/useLibrary';
import { useCollection } from './features/collection/useCollection';
import { getTodayDateKey } from './features/missions/rules';
import { useDailyMissions } from './features/missions/useDailyMissions';
import { useRecognition } from './features/recognition/useRecognition';
import { ShutterButton } from './design-system/components';
import './styles/application.css';

const CAMERA_ENABLED_STORAGE_KEY = 'words-in-life-camera-enabled-v1';

export default function App() {
  const [services] = useState(createServices);
  useEffect(() => () => services.close(), [services]);
  const store = useLibrary(services);
  if (store.loading) return <main className="vs-theme app-page" role="status">正在載入收藏…</main>;
  if (!store.library) return <main className="vs-theme app-page"><h1>暫時無法開啟收藏</h1><p role="alert">{store.error}</p><button className="vs-button" onClick={store.retry}>重新載入</button><p>原始資料仍保留，請確認瀏覽器允許網站儲存資料。</p></main>;
  return <Application store={store} />;
}

function Application({ store }: { store: ReturnType<typeof useLibrary> }) {
  const [geminiKey, setGeminiKey] = useState(readGeminiKey);
  const [settingsNotice, setSettingsNotice] = useState('');
  const [inputError, setInputError] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(() => {
    try { return localStorage.getItem(CAMERA_ENABLED_STORAGE_KEY) !== 'false'; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem(CAMERA_ENABLED_STORAGE_KEY, String(cameraEnabled)); } catch { /* setting remains usable in memory */ } }, [cameraEnabled]);
  const [navigation, setNavigation] = useState<'home' | 'favorites' | 'settings'>('home');
  const recognition = useRecognition(store.services.recognition);
  const activeView = navigation === 'home' && recognition.state.kind !== 'idle' ? recognition.state.kind : navigation;
  const currentAnalysis = recognition.state.kind === 'scene' ? recognition.state.result : null;
  const currentFailureInfo = recognition.state.kind === 'failure' ? recognition.state.failure : null;
  const printingImage = recognition.state.kind === 'analyzing' ? recognition.state.imageUrl : '';
  const printingFromCamera = recognition.state.kind === 'analyzing' && recognition.state.fromCamera;
  const [questSelection, setActiveQuestTarget] = useState<DailyMission | null>(null);
  const [missedQuestSelection, setMissedQuestTarget] = useState<DailyMission | null>(null);
  const [selectedItem, setSelectedItem] = useState<DetectedItem | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [celebrationSelection, setCompletedMissionCelebration] = useState<{ mission: DailyMission; matchedItem: DetectedItem } | null>(null);
  const [photoSelection, setMissionPhotoViewer] = useState<DailyMission | null>(null);
  const savedWords = store.library!.words;
  const collection = useCollection(savedWords, store, currentAnalysis);
  const [exploringMissions, setExploringMissions] = useState(false);
  const missions = useDailyMissions(store, exploringMissions);
  const missionGeneration = missions.generation;
  const missionsLoading = missionGeneration?.status !== 'ready' && !missions.missions.some(m => m.isCompleted);
  const missionsNotice = missionGeneration?.status === 'ready'
    ? missionGeneration.source === 'ai' ? missions.missions.some(m => m.kind === 'review') ? '依你的單字簿與今日時節安排：一項複習、兩項新探索。' : '依今日時節安排了三項生活新探索。'
      : missionGeneration.fallbackReason === 'missing-key' ? '今日使用備援任務。設定 Gemini API key 後，明日可生成個人化任務。'
      : missionGeneration.fallbackReason === 'started' ? '保留今日已開始的任務，明日再安排個人化內容。'
      : '今日暫時無法生成個人化任務，已為你保留備援題目。'
    : '正在參考你的單字簿，安排今日任務…';
  // Resolve selection against today's missions; a stale date can never reach the camera UI.
  const activeQuestTarget = missions.missions.find(mission => mission.id === questSelection?.id && !mission.isCompleted) || null;
  const dailyMissions = missions.missions;
  const streakCount = missions.streak;
  const missedQuestTarget = missions.missions.find(mission => mission.id === missedQuestSelection?.id && !mission.isCompleted) || null;
  const missionPhotoViewer = missions.missions.find(mission => mission.id === photoSelection?.id && mission.isCompleted) || null;
  const completedMissionCelebration = missions.missions.some(mission => mission.id === celebrationSelection?.mission.id && mission.isCompleted) ? celebrationSelection : null;
  const navigate = (view: 'home' | 'favorites' | 'settings') => {
    recognition.reset(); setNavigation(view); setInputError('');
    setCompletedMissionCelebration(null);
  };
  const handleToggleSave = collection.toggleSave;
  const handleRemoveWord = collection.removeWord;
  const handleStartQuest = async (mission: DailyMission) => {
    const result = await store.run(() => store.services.library.startMission(mission.id));
    const selected = result?.snapshot.daily.missions.find(m => m.id === mission.id && !m.isCompleted);
    if (selected) { setActiveQuestTarget(selected); navigate('home'); }
  };
  const acceptResult = async (result: AnalysisResult, isCurrent: () => boolean, signal: AbortSignal) => {
    const celebration = await missions.complete(result.items, result.imageUrl, result.analysisId || crypto.randomUUID(), activeQuestTarget?.id, signal);
    if (!isCurrent()) return;
    setCompletedMissionCelebration(celebration);
    setMissedQuestTarget(!celebration && activeQuestTarget?.id.startsWith(getTodayDateKey()) ? activeQuestTarget : null);
  };
  const analyzeImage = (imageUrl: string, fromCamera = false) => {
    const key = readGeminiKey(); setGeminiKey(key);
    if (!key) {
      setSettingsNotice('請先設定 Gemini API key，再回到首頁選擇或拍攝照片。'); navigate('settings'); return;
    }
    setNavigation('home'); setCompletedMissionCelebration(null); setInputError('');
    void recognition.run({ imageUrl, fromCamera, quest: activeQuestTarget, onResult: acceptResult });
  };
  const handleCapturePhoto = (imageUrl: string) => analyzeImage(imageUrl, true);
  const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setInputError('請選擇照片檔案。'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') analyzeImage(reader.result); };
    reader.onerror = () => setInputError('照片無法讀取，請重新選擇。');
    reader.readAsDataURL(file);
  };
  const handleSelectSampleScene = (sample: SampleScene) => {
    setNavigation('home'); setCompletedMissionCelebration(null); setMissedQuestTarget(null);
    void recognition.run({ imageUrl: sample.imageUrl, sample, quest: activeQuestTarget, onResult: acceptResult });
  };

  const detailItems: DetectedItem[] = activeView === 'favorites'
    ? savedWords.map(w => ({ ...w, position: w.position || { x: 50, y: 50 } }))
    : currentAnalysis?.items || [];
  const detailIndex = selectedItem ? detailItems.findIndex(w => w.id === selectedItem.id) : -1;
  return (
    <div className="vs-theme words-in-life-app">
      {(store.error || inputError) && <div className="storage-notice" role="alert"><p>{store.error || inputError}</p>{store.error && <button onClick={store.dismissError}>知道了</button>}</div>}
      {activeView === 'settings' && <SettingsView apiKey={geminiKey} notice={settingsNotice} onBack={() => navigate('home')} onSave={key => { saveGeminiKey(key); setGeminiKey(key); setSettingsNotice(''); }} />}
      {/* View 1: Home Screen */}
      {(activeView === 'home' || (activeView === 'analyzing' && !!printingImage)) && (
        <HomeView
          hasGeminiKey={!!geminiKey}
          onOpenSettings={() => { setSettingsNotice(''); navigate('settings'); }}
          cameraEnabled={cameraEnabled}
          onToggleCamera={() => setCameraEnabled(enabled => !enabled)}
          onCapture={handleCapturePhoto}
          printingImage={printingImage}
          printingFromCamera={printingFromCamera}
          onPrintComplete={recognition.finishPrint}
          onCancelPrinting={() => { setActiveQuestTarget(null); setMissedQuestTarget(null); navigate('home'); }}
          activeQuestTarget={activeQuestTarget}
          onCancelQuest={() => { setActiveQuestTarget(null); setMissedQuestTarget(null); }}
          onSelectFile={handleSelectFile}
          onSelectSampleScene={handleSelectSampleScene}
          onOpenFavorites={() => navigate('favorites')}
          savedWords={savedWords}
          dailyMissions={dailyMissions}
          onMissionsOpenChange={setExploringMissions}
          missionsLoading={missionsLoading}
          missionsNotice={missionsNotice}
          onStartQuest={handleStartQuest}
          onViewMissionSticker={(mission) => setMissionPhotoViewer(mission)}
          streakCount={streakCount}
          onOpenFailureDemo={(demoInfo) => {
            recognition.showFailure(demoInfo);
          }}
        />
      )}

      {/* View 3: Interactive Learning Scene Screen */}
      {activeView === 'scene' && currentAnalysis && (
        <SceneView
          result={currentAnalysis}
          onBack={() => {
            setMissedQuestTarget(null);
            navigate('home');
          }}
          onSelectItem={(item) => setSelectedItem(item)}
          onNewPhoto={() => {
            setActiveQuestTarget(null);
            setMissedQuestTarget(null);
            navigate('home');
          }}
          savedWords={savedWords}
          onToggleSave={handleToggleSave}
          onReanalyze={() => analyzeImage(currentAnalysis.imageUrl)}
          missedQuestTarget={missedQuestTarget}
          onRetryQuest={(mission) => handleStartQuest(mission)}
        />
      )}

      {/* View 6: Dedicated Recognition Failure / Diagnostic View */}
      {activeView === 'failure' && currentFailureInfo && (
        <RecognitionFailureView
          failureInfo={currentFailureInfo}
          onBack={() => {
            setActiveQuestTarget(null);
            setMissedQuestTarget(null);
            navigate('home');
          }}
          onRetakeCamera={() => {
            navigate('home');
          }}
          onSelectFile={handleSelectFile}
          onRetryCurrentPhoto={() => {
            if (currentFailureInfo.photoUrl) {
              analyzeImage(currentFailureInfo.photoUrl);
            }
          }}
          onSelectSampleScene={handleSelectSampleScene}
          onSwitchFailureDemo={(demoInfo) => {
            recognition.showFailure(demoInfo);
          }}
        />
      )}

      {/* View 5: Favorites Vocabulary Book */}
      {activeView === 'favorites' && (
        <FavoritesView
          photoUrls={store.services.photoUrls}
          savedWords={savedWords}
          onBack={() => navigate('home')}
          onSelectItem={(item) => setSelectedItem(item)}
          onRemoveWord={handleRemoveWord}
          onStartQuiz={() => setIsQuizOpen(true)}
        />
      )}

      {/* View 4: Word Detail Modal / Inspector */}
      {selectedItem && (
        <WordDetailModal
          photoUrls={store.services.photoUrls}
          key={selectedItem.id}
          storageError={store.error}
          item={selectedItem}
          index={Math.max(0, detailIndex)}
          total={detailItems.length || 1}
          onPrevious={detailIndex > 0 ? () => setSelectedItem(detailItems[detailIndex - 1]) : undefined}
          onNext={detailIndex >= 0 && detailIndex < detailItems.length - 1 ? () => setSelectedItem(detailItems[detailIndex + 1]) : undefined}
          imageUrl={selectedItem.originalImageUrl || currentAnalysis?.imageUrl}
          onClose={() => setSelectedItem(null)}
          isSaved={savedWords.some(
            (w) => w.word.toLowerCase() === selectedItem.word.toLowerCase()
          )}
          onToggleSave={() => handleToggleSave(selectedItem)}
          sceneTitle={activeView === 'favorites' ? savedWords.find(w => w.id === selectedItem.id)?.sceneTitle : currentAnalysis?.sceneTitle}
        />
      )}

      {activeView === 'favorites' && <nav className="collection-capture" aria-label="返回相機"><ShutterButton onClick={() => { setActiveQuestTarget(null); navigate('home'); window.scrollTo(0, 0); }} /></nav>}
      {/* Flashcard Quiz Modal */}
      {isQuizOpen && savedWords.length > 0 && (
        <FlashcardQuiz
          photoUrls={store.services.photoUrls}
          words={savedWords}
          onReview={collection.recordReview}
          onClose={() => setIsQuizOpen(false)}
        />
      )}

      {/* Mission Success Celebration Modal */}
      {completedMissionCelebration && (
        <MissionSuccessModal
          storageError={store.error}
          isOpen={!!completedMissionCelebration}
          onClose={() => setCompletedMissionCelebration(null)}
          mission={completedMissionCelebration.mission}
          matchedItem={completedMissionCelebration.matchedItem}
          onSaveWord={handleToggleSave}
          isSaved={savedWords.some(
            (w) =>
              w.word.toLowerCase() ===
              completedMissionCelebration.matchedItem.word.toLowerCase()
          )}
        />
      )}

      {/* Mission Completed Photo Viewer */}
      {missionPhotoViewer && missionPhotoViewer.completedPhoto && (
        <PhotoSourceModal
          photo={missionPhotoViewer.completedPhoto}
          photoUrls={store.services.photoUrls}
          isOpen={!!missionPhotoViewer}
          onClose={() => setMissionPhotoViewer(null)}
          originalImageUrl={''}
          word={missionPhotoViewer.targetWord}
          chinese={missionPhotoViewer.targetChinese}
          emoji={missionPhotoViewer.emoji}
          sceneTitle={`今日達成任務：${missionPhotoViewer.targetWord}`}
        />
      )}
    </div>
  );
}
