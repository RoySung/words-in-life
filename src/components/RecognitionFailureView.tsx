import { useRef, useState } from 'react';
import { ChevronLeft, Camera, Image, RotateCcw } from 'lucide-react';
import { RecognitionFailureInfo, SampleScene } from '../types';
import { SAMPLE_SCENES } from '../data/sampleScenes';
import { FAILURE_SCENARIO_DEMOS } from '../data/failureScenarios';
import { Button, IconButton, Polaroid } from '../design-system/components';
interface RecognitionFailureViewProps {
  failureInfo: RecognitionFailureInfo; onBack: () => void; onOpenSettings: () => void; onRetakeCamera: () => void;
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onRetryCurrentPhoto: () => void;
  onSelectSampleScene: (scene: SampleScene) => void; onSwitchFailureDemo?: (info: RecognitionFailureInfo) => void;
}
function FailureMessage({ info }: { info: RecognitionFailureInfo }) {
  const taps = useRef({ count: 0, last: 0 });
  const [unlocked, setUnlocked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const log = info.diagnostics || JSON.stringify({ reasonCode: info.reasonCode, message: 'Recognition returned a photography hint; no technical error was reported.' }, null, 2);
  const tap = () => {
    const now = Date.now();
    taps.current.count = now - taps.current.last <= 2000 ? taps.current.count + 1 : 1;
    taps.current.last = now;
    if (taps.current.count >= 5) { setUnlocked(true); setExpanded(true); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(log); setCopyStatus('已複製'); }
    catch { setCopyStatus('無法複製，請選取下方內容手動複製。'); }
  };
  return <>
    <section className="failure-message" role="alert" onClick={tap}>
      <h1><button className="failure-message-trigger" type="button">{info.title}</button></h1>
      <p>{info.description}</p><ul>{info.suggestions.map((s, i) => <li key={i}>{s.replace(/^[^\p{L}\p{N}]+/u, '')}</li>)}</ul>
    </section>
    {unlocked && <section className="failure-diagnostics" aria-label="開發診斷資訊">
      <h2>Dev mode · Error log</h2>
      <Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '收合 error log' : '展開 error log'}</Button>
      {expanded && <><Button variant="secondary" onClick={copy}>複製 error log</Button><p role="status">{copyStatus}</p><pre tabIndex={0}>{log}</pre></>}
    </section>}
  </>;
}
export function RecognitionFailureView({ failureInfo: info, onBack, onOpenSettings, onRetakeCamera, onSelectFile, onRetryCurrentPhoto, onSelectSampleScene, onSwitchFailureDemo }: RecognitionFailureViewProps) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="app-page failure-page"><header className="page-header"><IconButton label="返回首頁" onClick={onBack}><ChevronLeft /></IconButton><span>再給這張照片一次機會</span></header><main>
    {info.photoUrl && <Polaroid src={info.photoUrl} alt="未能順利辨識的照片" taped />}
    <FailureMessage key={info.diagnostics || info.title} info={info} />
    {info.activeQuestTarget && <p className="muted">任務目標：{info.activeQuestTarget.targetWord} · {info.activeQuestTarget.targetChinese}</p>}
    <div className="stack-actions">
      {info.recovery === 'settings' && <Button onClick={onOpenSettings}>檢查 API key 設定</Button>}
      {info.recovery === 'retry' && <Button onClick={onRetryCurrentPhoto} disabled={!info.photoUrl}><RotateCcw />重新辨識本圖</Button>}
      <Button variant={info.recovery ? 'secondary' : 'primary'} onClick={onRetakeCamera}><Camera />重新拍攝</Button>
      <Button variant="secondary" onClick={() => input.current?.click()}><Image />選擇其他照片</Button>
      {info.recovery !== 'retry' && <Button variant="ghost" onClick={onRetryCurrentPhoto} disabled={!info.photoUrl}><RotateCcw />重新辨識本圖</Button>}
    </div><input ref={input} hidden type="file" accept="image/*" onChange={onSelectFile} />
    <section className="home-section"><h2>也可以先從範例開始</h2><div className="sample-gallery">{SAMPLE_SCENES.map(s => <button key={s.id} onClick={() => onSelectSampleScene(s)}><img src={s.thumbnail} alt={s.name} /><strong>{s.name}</strong></button>)}</div></section>
    {onSwitchFailureDemo && <details className="home-help"><summary>其他辨識提示範例</summary>{FAILURE_SCENARIO_DEMOS.map(d => <Button variant="ghost" key={d.id} onClick={() => onSwitchFailureDemo(d.failureInfo)}>{d.name}</Button>)}</details>}
  </main></div>;
}
