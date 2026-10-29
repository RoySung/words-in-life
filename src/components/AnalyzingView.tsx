import { X, RotateCcw } from 'lucide-react';
import { Button, IconButton, Polaroid, Progress } from '../design-system/components';
interface AnalyzingViewProps { imageUrl: string; onCancel: () => void; onAnalysisDone: () => void; error?: string | null; onRetry?: () => void; }
export function AnalyzingView({ imageUrl, onCancel, error, onRetry }: AnalyzingViewProps) {
  return <div className="app-page developing-page"><header className="page-header"><IconButton label="取消辨識" onClick={onCancel}><X /></IconButton><span>讓日常慢慢顯影</span></header><main className="developing-machine"><div className="printer-mouth" aria-hidden="true" /><Polaroid src={imageUrl} alt="正在辨識的照片" className="developing-photo">{error ? <div role="alert"><h1>這次沒有順利顯影</h1><p>{error}</p><Button onClick={onRetry}><RotateCcw />重新辨識</Button></div> : <div role="status"><h1>正在識別單字…</h1><Progress label="正在準備照片中的英文與例句" /><p>一張照片，一個新的發現。</p></div>}</Polaroid></main><footer>ANOTHER PERSPECTIVE.<br />A BRIGHTER YOU.</footer></div>;
}
