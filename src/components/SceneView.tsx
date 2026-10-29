import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { ChevronLeft, Camera, Eye, EyeOff, PlusCircle, CheckCircle, Volume2, Trash2 } from 'lucide-react';
import { AnalysisResult, DetectedItem, SavedWord, DailyMission } from '../types';
import { speakEnglish } from '../utils/audio';
import { Button, IconButton, PhotoMarker } from '../design-system/components';
interface SceneViewProps {
  result: AnalysisResult; onBack: () => void; onSelectItem: (item: DetectedItem) => void; onNewPhoto: () => void;
  savedWords: SavedWord[]; onToggleSave: (item: DetectedItem) => void | Promise<void>;
  onReanalyze?: () => void; missedQuestTarget?: DailyMission | null; onRetryQuest?: (mission: DailyMission) => void;
}
export function SceneView({ result, onBack, onSelectItem, onNewPhoto, savedWords, onToggleSave, onReanalyze, missedQuestTarget, onRetryQuest }: SceneViewProps) {
  const photoRef = useRef<HTMLDivElement>(null);
  const [frameRatio, setFrameRatio] = useState(.8);
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; if (height) setFrameRatio(width / height); });
    if (photoRef.current) observer.observe(photoRef.current);
    return () => observer.disconnect();
  }, []);
  const [ratio, setRatio] = useState(1);
  const [pins, setPins] = useState(true);
  const [saving, setSaving] = useState(false);
  const saved = (item: DetectedItem) => savedWords.some(w => w.word.toLowerCase() === item.word.toLowerCase());
  const markers: { x: number; y: number }[] = [];
  for (const item of result.items) {
    const cropScale = Math.max(1, ratio / frameRatio);
    const heightScale = Math.max(1, frameRatio / ratio);
    const anchorX = 50 + (item.position.x - 50) * cropScale;
    const anchorY = 50 + (item.position.y - 50) * heightScale;
    let x = Math.max(5, Math.min(73, anchorX));
    let y = Math.max(4, Math.min(88, anchorY));
    if (markers.some(p => Math.abs(p.x - x) < 27 && Math.abs(p.y - y) < 11)) x = Math.max(5, x - 31);
    markers.push({ x, y });
  }
  const allSaved = result.items.every(saved);
  const saveAll = async () => { setSaving(true); try { for (const item of result.items.filter(i => !saved(i))) await onToggleSave(item); } finally { setSaving(false); } };
  return <div className="app-page scene-page" style={{ "--scene-rows": Math.min(5, result.items.length) } as CSSProperties}><header className="page-header"><IconButton label="返回首頁" onClick={onBack}><ChevronLeft /></IconButton><span className="vs-sr-only">{result.sceneTitle}</span><IconButton label="捨棄照片並返回首頁" onClick={onBack}><Trash2 /></IconButton></header>
    <main><figure className="scene-polaroid vs-polaroid vs-polaroid--taped"><div ref={photoRef} className="scene-image"><img src={result.imageUrl} alt={result.sceneDescription} onLoad={e => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />{pins && result.items.map((item, index) => <PhotoMarker key={item.id} label={item.word} x={markers[index].x} y={markers[index].y} onClick={() => onSelectItem(item)} />)}</div></figure>
    <section className="discovery-sheet"><div className="section-heading"><h1>發現了 {result.items.length} 個單字</h1><Button variant="ghost" loading={saving} disabled={allSaved} onClick={saveAll}>{allSaved ? '已全部加入' : '全部加入'}<PlusCircle /></Button></div>{result.items.map(item => <div className="discovery-row" key={item.id}><button className="discovery-open" onClick={() => onSelectItem(item)}><img src={item.stickerUrl || result.imageUrl} alt="" /><strong lang="en">{item.word}</strong><span>{item.partOfSpeech === "名詞" ? "n." : item.partOfSpeech} {item.chinese}</span></button><IconButton label={`播放 ${item.word} 發音`} onClick={() => speakEnglish(item.word)}><Volume2 /></IconButton><IconButton label={`${saved(item) ? '移除' : '收藏'} ${item.word}`} aria-pressed={saved(item)} onClick={() => onToggleSave(item)}>{saved(item) ? <CheckCircle /> : <PlusCircle />}</IconButton></div>)}</section>
    {missedQuestTarget && <section className="context-note"><p>還沒找到「{missedQuestTarget.targetChinese}」，這些新單字也值得留下。</p><Button onClick={() => onRetryQuest?.(missedQuestTarget)}>繼續尋寶</Button></section>}
    <details className="scene-tools"><summary>照片選項</summary><div className="action-group"><Button variant="secondary" onClick={onNewPhoto}><Camera />拍攝新照片</Button><Button variant="secondary" onClick={() => setPins(!pins)}>{pins ? <EyeOff /> : <Eye />}{pins ? '隱藏標記' : '顯示標記'}</Button>
    {onReanalyze && <Button className="reanalyze-button" variant="secondary" onClick={onReanalyze}>重新辨識這張照片</Button>}
    </div></details></main></div>;
}
