import React, { useEffect, useRef, useState } from 'react';
import { Image, ArrowUpRight, Check, Info, Images, X, ChevronDown, CameraOff, Camera, RotateCcw, Settings } from 'lucide-react';
import { SAMPLE_SCENES } from '../data/sampleScenes';
import { SampleScene, SavedWord, DailyMission, RecognitionFailureInfo } from '../types';
import { Button, IconButton, ShutterButton, Tag } from '../design-system/components';
import { useDialog } from '../hooks/useDialog';
import { useLiveCamera } from '../hooks/useLiveCamera';
import { playSfx } from '../utils/audio';
import { FAILURE_SCENARIO_DEMOS } from '../data/failureScenarios';
interface HomeViewProps {
  hasGeminiKey?: boolean; onOpenSettings?: () => void;
  cameraEnabled: boolean; onToggleCamera: () => void;
  onCapture: (image: string) => void; onSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectSampleScene: (scene: SampleScene) => void; onOpenFavorites: () => void;
  savedWords: SavedWord[]; dailyMissions: DailyMission[]; onStartQuest: (mission: DailyMission) => void;
  onMissionsOpenChange?: (open: boolean) => void; missionsLoading?: boolean; missionsNotice?: string;
  activeQuestTarget?: DailyMission | null; onCancelQuest: () => void;
  onViewMissionSticker?: (mission: DailyMission) => void; streakCount: number;
  onOpenFailureDemo?: (demoInfo: RecognitionFailureInfo) => void;
  printingImage?: string; printingFromCamera?: boolean; onCancelPrinting?: () => void; onPrintComplete?: () => void;
}
function ExploreSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useDialog(onClose);
  return <dialog ref={ref} className="explore-sheet" aria-label="今日任務與探索"><header className="page-header"><h1>今日尋寶</h1><IconButton label="關閉探索" onClick={onClose}><X /></IconButton></header>{children}</dialog>;
}
export function HomeView(props: HomeViewProps) {
  const [exploring, setExploring] = useState(false);
  const onMissionsOpenChange = props.onMissionsOpenChange;
  useEffect(() => {
    onMissionsOpenChange?.(exploring);
    return () => onMissionsOpenChange?.(false);
  }, [exploring, onMissionsOpenChange]);
  const file = useRef<HTMLInputElement>(null);
  const camera = useLiveCamera(props.cameraEnabled && !props.printingImage);
  const completed = props.dailyMissions.filter(m => m.isCompleted).length;
  const target = props.activeQuestTarget && !props.activeQuestTarget.isCompleted ? props.activeQuestTarget : null;
  const selectSample = (scene: SampleScene) => { setExploring(false); props.onSelectSampleScene(scene); };
  const takePhoto = () => { const image = camera.capture(); if (image) { playSfx('shutter'); props.onCapture(image); } };
  return <div className={`app-page home-page${props.printingImage ? ' is-printing' : ''}${props.printingFromCamera ? ' is-capture' : ''}`}>
    <header className="camera-utility">
      <span>Words in Life</span>
      {props.onOpenSettings && <button type="button" className="home-settings-button" onClick={props.onOpenSettings} disabled={!!props.printingImage} aria-label={props.hasGeminiKey ? '開啟設定' : '尚未設定 API key，前往設定'}><Settings aria-hidden="true" /></button>}
    </header>
    <main>
      <section className="camera-body" aria-label="拍照學英文">
        <div className="camera-top">
          <button type="button" className="camera-toggle" role="switch" aria-label="鏡頭" aria-checked={props.cameraEnabled} title={props.cameraEnabled ? '暫時關閉鏡頭' : '重新開啟鏡頭'} onClick={props.onToggleCamera} disabled={!!props.printingImage}>
            <span className="camera-toggle-hardware" aria-hidden="true"><span className="camera-toggle-track"><span className="camera-toggle-grip" /></span><span className="camera-toggle-label">{props.cameraEnabled ? <Camera /> : <CameraOff />}</span></span>
            <span className="camera-toggle-state" aria-hidden="true">{props.cameraEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <div className="camera-stripes" aria-hidden="true"><i /><i /><i /></div><div className="camera-lens" aria-hidden="true" />
        </div>
        <div className="home-viewfinder" aria-label="即時相機觀景窗" inert={!!props.printingImage}>
          <div ref={camera.previewRef} className="camera-preview"><div className="camera-preview-frame" style={camera.previewStyle}><video ref={camera.videoRef} autoPlay muted playsInline onLoadedData={camera.onReady} onResize={camera.onReady} style={{ transform: `scale(${camera.zoom})` }} aria-label="相機即時影像" /></div></div>
          <div className="mission-viewfinder-controls"><button className="mission-viewfinder-entry" aria-haspopup="dialog" onClick={() => setExploring(true)}><span>{target ? `尋找：${target.targetChinese}` : '今日尋寶'}</span><span>{completed}/{props.dailyMissions.length}</span><ChevronDown /></button>{target && <IconButton className="cancel-quest" label="取消目前任務" onClick={props.onCancelQuest}><X /></IconButton>}</div>
          <span className="viewfinder-corners" />
          {props.cameraEnabled && camera.status === 'ready' && <button className="viewfinder-zoom" type="button" aria-label={`目前 ${camera.zoom} 倍，切換至 ${camera.zoom === 1 ? 2 : 1} 倍`} aria-pressed={camera.zoom === 2} onClick={() => camera.setZoom(previous => previous === 1 ? 2 : 1)}><span>{camera.zoom}x</span></button>}
          {!props.cameraEnabled && <div className="home-camera-status" role="status"><CameraOff aria-hidden="true" /><p>鏡頭已暫時關閉<br />點選左上角開關即可繼續拍照</p></div>}
          {props.cameraEnabled && camera.status !== 'ready' && <div className="home-camera-status" role={camera.status === 'error' ? 'alert' : 'status'}><Camera /><p>{camera.status === 'starting' ? '正在開啟相機…' : camera.error}</p>{camera.status === 'error' && <><Button variant="secondary" onClick={camera.retry}><RotateCcw />重新嘗試</Button><Button onClick={() => file.current?.click()}><Image />選擇照片</Button><Button variant="ghost" className="sample-fallback" onClick={() => setExploring(true)}>先體驗範例照片</Button></>}</div>}
        </div>
        <div className="camera-controls" inert={!!props.printingImage}><div className="camera-control-label"><IconButton className="gallery-thumbnail" label="選照片" onClick={() => file.current?.click()}><Image /></IconButton><span>選照片</span></div><ShutterButton onClick={takePhoto} disabled={!props.cameraEnabled || camera.status !== 'ready'} /><div className="camera-control-label"><button className="collection-counter" aria-label={`我的單字，已收藏 ${props.savedWords.length} 個單字`} onClick={props.onOpenFavorites}><Images aria-hidden="true" /><span aria-hidden="true">{props.savedWords.length}</span></button><span>我的單字</span></div></div>
        <input ref={file} hidden type="file" accept="image/*" onChange={props.onSelectFile} />
        <div className="camera-print-slot"><span aria-hidden="true">SNAP · LEARN · GROW</span>{props.printingImage && <div className="print-output">
          <figure className="home-print-photo" aria-label="正在辨識的照片" onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'print-feed') props.onPrintComplete?.(); }}>
            {['right', 'top', 'left', 'bottom'].map(side => <div key={side} className={`recognition-paper recognition-paper--${side}`} aria-hidden="true"><span className="recognition-paper-eyes"><i /><i /></span><span className="recognition-paper-smile" /><span className="recognition-paper-fold" /></div>)}
            <img src={props.printingImage} alt="剛選擇的照片" />
            <figcaption>
              <div className="recognition-search" aria-hidden="true"><span className="recognition-magnifier"><span className="recognition-lens-detail"><i /><i /><i /></span></span></div>
              <span role="status">正在找照片裡的單字<span className="recognition-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span>
            </figcaption>
          </figure>
          <button type="button" className="print-cancel" onClick={props.onCancelPrinting}><X aria-hidden="true" />取消辨識</button>
        </div>}</div>
      </section>
      {exploring && <ExploreSheet onClose={() => setExploring(false)}>
        <section className="home-section"><div className="section-heading"><h2>今天，發現身邊的英文</h2><span>{completed}/{props.dailyMissions.length} 已完成</span></div><p className="muted">連續探索 {props.streakCount} 天 · 選一個目標，回到鏡頭找找看。</p>{props.missionsNotice && <p className="mission-notice muted" role="status">{props.missionsNotice}</p>}<div className="mission-list" aria-busy={!!props.missionsLoading}>{props.dailyMissions.map(m => <button key={m.id} disabled={!!props.missionsLoading} onClick={() => { setExploring(false); if (m.isCompleted) props.onViewMissionSticker?.(m); else props.onStartQuest(m); }}><div><strong>{m.targetWord}{m.kind && <span className="mission-kind">{m.kind === 'review' ? '複習' : '新探索'}</span>}</strong><span>{m.targetChinese} · {m.hint}</span>{m.reason && <span className="mission-reason">{m.reason}</span>}</div>{m.isCompleted ? <Check aria-label="已完成" /> : <ArrowUpRight />}</button>)}</div></section>
        <section className="home-section"><div className="section-heading"><h2>換個角度，看見新單字</h2><Tag>範例體驗</Tag></div><Button variant="ghost" onClick={() => selectSample(SAMPLE_SCENES[0])}>體驗範例照片</Button><div className="sample-gallery">{SAMPLE_SCENES.map(scene => <button key={scene.id} onClick={() => selectSample(scene)}><img src={scene.thumbnail} alt={scene.name} loading="lazy" /><strong>{scene.name}</strong><span>{scene.items.length} 個單字</span></button>)}</div></section>
        <details className="home-help"><summary><Info />關於拍照學英文</summary><p>拍下生活中的物品，查看英文、例句並練習發音。收藏的單字會儲存在這個瀏覽器，隨時能翻卡複習。</p><p>照片不夠清楚時，也可以試試以下辨識提示範例。</p><div className="action-group">{FAILURE_SCENARIO_DEMOS.map(d => <Button key={d.id} variant="secondary" onClick={() => props.onOpenFailureDemo?.(d.failureInfo)}>{d.name.split('/')[0]}</Button>)}</div></details>
      </ExploreSheet>}
    </main>
  </div>;
}
