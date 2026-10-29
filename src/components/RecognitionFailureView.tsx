import { useRef } from 'react';
import { ChevronLeft, Camera, Image, RotateCcw } from 'lucide-react';
import { RecognitionFailureInfo, SampleScene } from '../types';
import { SAMPLE_SCENES } from '../data/sampleScenes';
import { FAILURE_SCENARIO_DEMOS } from '../data/failureScenarios';
import { Button, IconButton, Polaroid } from '../design-system/components';
interface RecognitionFailureViewProps {
  failureInfo: RecognitionFailureInfo; onBack: () => void; onRetakeCamera: () => void;
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onRetryCurrentPhoto: () => void;
  onSelectSampleScene: (scene: SampleScene) => void; onSwitchFailureDemo?: (info: RecognitionFailureInfo) => void;
}
export function RecognitionFailureView({ failureInfo: info, onBack, onRetakeCamera, onSelectFile, onRetryCurrentPhoto, onSelectSampleScene, onSwitchFailureDemo }: RecognitionFailureViewProps) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="app-page failure-page"><header className="page-header"><IconButton label="返回首頁" onClick={onBack}><ChevronLeft /></IconButton><span>再給這張照片一次機會</span></header><main>
    {info.photoUrl && <Polaroid src={info.photoUrl} alt="未能順利辨識的照片" taped />}
    <section className="failure-message" role="alert"><h1>{info.title}</h1><p>{info.description}</p><ul>{info.suggestions.map((s,i) => <li key={i}>{s.replace(/^[^\p{L}\p{N}]+/u, '')}</li>)}</ul></section>
    {info.activeQuestTarget && <p className="muted">任務目標：{info.activeQuestTarget.targetWord} · {info.activeQuestTarget.targetChinese}</p>}
    <div className="stack-actions"><Button onClick={onRetakeCamera}><Camera />重新拍攝</Button><Button variant="secondary" onClick={() => input.current?.click()}><Image />選擇其他照片</Button><Button variant="ghost" onClick={onRetryCurrentPhoto} disabled={!info.photoUrl}><RotateCcw />重新辨識本圖</Button></div><input ref={input} hidden type="file" accept="image/*" onChange={onSelectFile} />
    <section className="home-section"><h2>也可以先從範例開始</h2><div className="sample-gallery">{SAMPLE_SCENES.map(s => <button key={s.id} onClick={() => onSelectSampleScene(s)}><img src={s.thumbnail} alt={s.name} /><strong>{s.name}</strong></button>)}</div></section>
    {onSwitchFailureDemo && <details className="home-help"><summary>其他辨識提示範例</summary>{FAILURE_SCENARIO_DEMOS.map(d => <Button variant="ghost" key={d.id} onClick={() => onSwitchFailureDemo(d.failureInfo)}>{d.name}</Button>)}</details>}
  </main></div>;
}
