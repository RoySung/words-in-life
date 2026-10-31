import { useState } from 'react';
import { ChevronLeft, Camera, Eye, EyeOff, PlusCircle, CheckCircle, Volume2, RotateCcw } from 'lucide-react';
import { AnalysisResult, DetectedItem, SavedWord, DailyMission } from '../types';
import { speakEnglish } from '../utils/audio';
import { Button, IconButton, PhotoMarker } from '../design-system/components';
interface SceneViewProps {
  result: AnalysisResult; onBack: () => void; onSelectItem: (item: DetectedItem) => void; onNewPhoto: () => void;
  savedWords: SavedWord[]; onToggleSave: (item: DetectedItem) => void | Promise<void>;
  onReanalyze?: () => void; missedQuestTarget?: DailyMission | null; onRetryQuest?: (mission: DailyMission) => void;
}
export function SceneView({ result, onBack, onSelectItem, onNewPhoto, savedWords, onToggleSave, onReanalyze, missedQuestTarget, onRetryQuest }: SceneViewProps) {
  const [pins, setPins] = useState(true);
  const [saving, setSaving] = useState(false);
  const saved = (item: DetectedItem) => savedWords.some(w => w.word.toLowerCase() === item.word.toLowerCase());
  const markers: { x: number; y: number }[] = [];
  for (const item of result.items) {
    let x = Math.max(5, Math.min(73, item.position.x));
    let y = Math.max(4, Math.min(88, item.position.y));
    if (markers.some(p => Math.abs(p.x - x) < 27 && Math.abs(p.y - y) < 11)) x = Math.max(5, x - 31);
    markers.push({ x, y });
  }
  const allSaved = result.items.every(saved);
  const saveAll = async () => { setSaving(true); try { for (const item of result.items.filter(i => !saved(i))) await onToggleSave(item); } finally { setSaving(false); } };
  return <div className="app-page scene-page vs-surface-dark"><header className="page-header"><Button className="scene-back" variant="ghost" aria-label="返回首頁" onClick={onBack}><ChevronLeft aria-hidden="true" />返回</Button><span className="vs-sr-only">{result.sceneTitle}</span></header>
    <main><figure className="scene-polaroid vs-polaroid vs-polaroid--taped"><div className="scene-image"><img src={result.imageUrl} alt={result.sceneDescription} />{pins && result.items.map((item, index) => <PhotoMarker key={item.id} label={item.word} x={markers[index].x} y={markers[index].y} onClick={() => onSelectItem(item)} />)}</div><figcaption className="scene-photo-actions"><Button variant="secondary" className="scene-marker-toggle" onClick={() => setPins(previous => !previous)}>{pins ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{pins ? '隱藏標記' : '顯示標記'}</Button></figcaption></figure>
    <section className="discovery-sheet"><div className="section-heading"><h1>發現了 {result.items.length} 個單字</h1><Button variant="ghost" loading={saving} disabled={allSaved} onClick={saveAll}>{allSaved ? '已全部加入' : '全部加入'}<PlusCircle /></Button></div>{result.items.map(item => <div className="discovery-row" key={item.id}><button className="discovery-open" onClick={() => onSelectItem(item)}><img src={item.stickerUrl || result.imageUrl} alt="" /><strong lang="en">{item.word}</strong><span>{item.partOfSpeech === "名詞" ? "n." : item.partOfSpeech} {item.chinese}</span></button><IconButton label={`播放 ${item.word} 發音`} onClick={() => speakEnglish(item.word)}><Volume2 /></IconButton><IconButton label={`${saved(item) ? '移除' : '收藏'} ${item.word}`} aria-pressed={saved(item)} onClick={() => onToggleSave(item)}>{saved(item) ? <CheckCircle /> : <PlusCircle />}</IconButton></div>)}</section>
    {missedQuestTarget && <section className="context-note"><p>還沒找到「{missedQuestTarget.targetChinese}」，這些新單字也值得留下。</p><Button onClick={() => onRetryQuest?.(missedQuestTarget)}>繼續尋寶</Button></section>}
    {onReanalyze && <Button className="scene-reanalyze" variant="secondary" onClick={onReanalyze}><RotateCcw aria-hidden="true" />重新辨識</Button>}
    </main>
    <footer className="scene-capture"><Button className="scene-shutter" onClick={onNewPhoto}><span className="scene-shutter-face"><Camera aria-hidden="true" /></span><span className="scene-shutter-label">再拍一張</span></Button></footer>
  </div>;
}
