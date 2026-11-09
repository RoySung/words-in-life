/** Isolated mission scenarios; never writes to the application's library. */
import { useState } from 'react';
import { Search } from 'lucide-react';
import { DailyMissionSection } from '../components/DailyMissionSection';
import { WordDetailModal } from '../components/WordDetailModal';
import { SAMPLE_SCENES } from '../data/sampleScenes';
import type { DailyMission, DetectedItem } from '../types';
import '../styles/application.css';

const scene = SAMPLE_SCENES[0];
const fixtures: DailyMission[] = scene.items.slice(0, 3).map((item, i) => ({
  id: `preview-mission-${i}`, targetWord: item.word, targetChinese: item.chinese,
  phonetic: item.phonetic, partOfSpeech: item.partOfSpeech, emoji: item.emoji,
  hint: ['看看桌面，有沒有這個小發現？', '找找身邊常用的東西。', '換個角度，也許就在旁邊。'][i],
  synonyms: [], isCompleted: false, completedItem: item,
  completedPhotoUrl: scene.imageUrl, completedStickerUrl: item.stickerUrl,
}));

export function MissionPreview() {
  const requested = new URLSearchParams(window.location.search).get('state');
  const initial = requested === 'complete' ? fixtures.map(m => m.id) : requested === 'empty' || requested === 'loading' ? [] : [fixtures[1].id];
  const [loading, setLoading] = useState(requested === 'loading');
  const [replaced, setReplaced] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>(initial);
  const [detail, setDetail] = useState<DetectedItem | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const missions = fixtures.map((m, index) => {
    const replacement = scene.items[index + 3] || SAMPLE_SCENES[1].items[index];
    return { ...m, ...(replaced.includes(m.id) ? { id: `${m.id}_replacement`, targetWord: replacement.word, targetChinese: replacement.chinese, replaced: true, completedItem: replacement, completedStickerUrl: replacement.stickerUrl } : {}), isCompleted: completed.includes(m.id) || completed.includes(`${m.id}_replacement`) };
  });
  return <div className="vs-theme words-in-life-app"><main className="app-page" style={{ maxWidth: 560, margin: 'auto' }}>
    <aside aria-label="預覽情境" style={{ marginBottom: 24 }}><p className="muted">展示資料 · 點選「拍這個」可模擬完成</p><div className="action-group">
      <button className="vs-button vs-button--secondary" onClick={() => { setLoading(false); setCompleted([]); }}>全部未完成</button>
      <button className="vs-button vs-button--secondary" onClick={() => { setLoading(false); setCompleted([fixtures[1].id]); }}>完成一項</button>
      <button className="vs-button vs-button--secondary" onClick={() => { setLoading(false); setCompleted(missions.map(m => m.id)); }}>全部完成</button>
      <button className="vs-button vs-button--secondary" onClick={() => { setCompleted([]); setLoading(true); }}>更新中</button>
      <button className="vs-button vs-button--secondary" onClick={() => { setLoading(false); setCompleted([]); setReplaced([]); }}>重設更換</button>
    </div></aside>
    <header className="page-header"><h1 className="quest-title"><Search aria-hidden="true" />今日尋寶</h1></header>
    <DailyMissionSection missions={missions} streakCount={2} loading={loading}
      onReplace={mission => setReplaced(ids => [...new Set([...ids, mission.id])])}
      onStartQuest={mission => setCompleted(ids => [...new Set([...ids, mission.id])])}
      onViewSticker={mission => setDetail({ ...mission.completedItem!, originalImageUrl: scene.imageUrl, stickerUrl: mission.completedStickerUrl })} />
    {detail && <WordDetailModal item={detail} imageUrl={scene.imageUrl} sceneTitle={scene.sceneTitle} onClose={() => setDetail(null)} isSaved={saved.includes(detail.id)} onToggleSave={() => setSaved(ids => ids.includes(detail.id) ? ids.filter(id => id !== detail.id) : [...ids, detail.id])} />}
  </main></div>;
}
