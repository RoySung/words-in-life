import '../design-system/foundation.css';
import '../styles/startup.css';

export type StartupPhase = 'boot' | 'library' | 'ready' | 'error';

type StartupViewProps =
  | { phase?: 'boot' | 'library'; error?: never; onRetry?: never }
  | { phase: 'error'; error: string; onRetry: () => void };

export function StartupView(props: StartupViewProps) {
  const phase = props.phase ?? 'boot';
  const failed = phase === 'error';
  const heading = failed ? '暫時無法開啟單字簿' : '準備中';

  return (
    <main className="vs-theme startup-page" data-phase={phase} aria-labelledby="startup-heading">
      <div className="startup-content">
        <p className="startup-brand">Words in Life</p>
        <div className="startup-scene" aria-hidden="true">
          <span className="startup-shadow" />
          <div className="startup-camera">
            <div className="startup-camera-top"><span className="startup-flash" /><span className="startup-stripes" /></div>
            <span className="startup-lens" /><span className="startup-shutter" /><span className="startup-slot" />
            <div className="startup-print-feed"><div className="startup-print"><span>hello!</span></div></div>
          </div>
        </div>
        <div className="startup-status" role={failed ? 'alert' : 'status'} aria-atomic="true">
          <h1 id="startup-heading" className={failed ? undefined : 'startup-status-label'}>{heading}</h1>
          {failed && <p className="startup-hint">原始資料仍保留。請確認瀏覽器允許網站儲存資料，再試一次。</p>}
          {props.error ? <p className="startup-error">{props.error}</p> : null}
        </div>
        {props.phase === 'error' && <button type="button" className="vs-button vs-button--primary startup-retry" onClick={props.onRetry}>重新載入</button>}
        <p className="startup-footer">把日常，變成你的單字簿</p>
      </div>
    </main>
  );
}
