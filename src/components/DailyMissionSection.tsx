import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Volume2, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import type { DailyMission } from '../types';
import { IconButton } from '../design-system/components';
import { speakEnglish, playSfx } from '../utils/audio';

interface Props {
  missions: DailyMission[];
  onStartQuest: (mission: DailyMission) => void;
  onViewSticker?: (mission: DailyMission) => void;
  streakCount: number;
  loading?: boolean;
  onReplace?: (mission: DailyMission) => void;
  replacingId?: string | null;
  notice?: string;
}

export function DailyMissionSection({ missions, onStartQuest, onViewSticker, streakCount, loading, notice, onReplace, replacingId }: Props) {
  const section = useRef<HTMLElement>(null);
  const [motionPaused, setMotionPaused] = useState(false);
  useEffect(() => {
    if (!loading) return;
    let visible = true;
    const update = () => setMotionPaused(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    if (section.current) observer.observe(section.current);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [loading]);
  const completed = missions.filter(m => m.isCompleted);
  const allDone = missions.length > 0 && completed.length === missions.length;
  return <section ref={section} className={`home-section daily-quest${motionPaused ? ' is-motion-paused' : ''}`} aria-busy={!!loading || !!replacingId}>
    <p className="quest-intro">看到哪個，就拍哪個。</p>
    {streakCount > 0 && <p className="muted">連續探索 {streakCount} 天</p>}
    <div className="quest-status-switch" role="status" aria-live="polite" aria-atomic="true" data-loading={!!loading}>
      <div className="quest-status-page quest-progress" aria-hidden={!!loading}><span>今天找到：</span><span className="quest-dots" aria-hidden="true">{missions.map((m, i) => <i key={m.id} className={i < completed.length ? 'is-filled' : ''} />)}</span><span>{completed.length} / {missions.length}</span></div>
      <div className="quest-status-page quest-updating quest-updating--search" aria-hidden={!loading}><span>正在更新今天的尋寶任務</span><span className="quest-search-indicator" aria-hidden="true"><i /><i /><i /><Search /></span></div>
    </div>
    {completed.length > 0 && <p className="quest-cheer" role="status">{allDone ? '今天全部找到了！' : `找到 ${completed.length} 樣了！`}</p>}
    {replacingId && <p className="quest-updating" role="status"><LoaderCircle aria-hidden="true" />正在更換單字…</p>}
    {!missions.length && <p className="muted" role="status">{loading ? '正在準備今天的尋寶…' : '今天的任務準備好後，就能開始尋寶。'}</p>}
    <div className={`quest-cards${loading ? ' is-updating' : ''}`}>{missions.map((mission, index) => <MissionCardSlot key={`${mission.id.split('_')[0]}:${index}`} mission={mission} loading={loading} replacingId={replacingId} onReplace={onReplace} onStartQuest={onStartQuest} onViewSticker={onViewSticker} />)}</div>
    {allDone && <p className="muted quest-finish">點選喇叭，聽聽今天找到的單字。明天再來找找看！</p>}
    {notice && <details className="quest-notice"><summary>關於今天的任務</summary><p>{notice}</p></details>}
  </section>;
}


function MissionCardSlot({ mission, loading, replacingId, onReplace, onStartQuest, onViewSticker }: Pick<Props, 'loading' | 'replacingId' | 'onReplace' | 'onStartQuest' | 'onViewSticker'> & { mission: DailyMission }) {
  const card = useRef<HTMLElement>(null);
  const [displayed, setDisplayed] = useState(mission);
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const m = displayed.id === mission.id ? mission : displayed;
  const flipping = phase !== 'idle' || (displayed.id !== mission.id && !!mission.replaced);

  useLayoutEffect(() => {
    if (displayed.id !== mission.id) {
      // Generation and rollover update immediately; only a replacement turns over.
      if (!mission.replaced) { setDisplayed(mission); setPhase('idle'); return; }
      if (phase === 'idle') { setPhase('out'); return; }
    }
    if (phase === 'idle') return;
    let disposed = false;
    const outgoing = phase === 'out';
    const finish = () => {
      if (disposed) return;
      if (outgoing) { setDisplayed(mission); setPhase('in'); }
      else setPhase('idle');
    };
    if (!card.current?.animate) { finish(); return; }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frames = reduced
      ? [{ opacity: outgoing ? 1 : 0 }, { opacity: outgoing ? 0 : 1 }]
      : [{ transform: `rotateY(${outgoing ? 0 : -90}deg)` }, { transform: `rotateY(${outgoing ? 90 : 0}deg)` }];
    const animation = card.current.animate(frames, {
      duration: reduced ? outgoing ? 80 : 100 : outgoing ? 160 : 240,
      easing: outgoing ? 'cubic-bezier(.45,0,.8,.55)' : 'cubic-bezier(.16,1,.3,1)', fill: 'both',
    });
    void animation.finished.then(finish).catch(() => {});
    return () => { disposed = true; animation.cancel(); };
  }, [mission.id, mission.replaced, displayed.id, phase]);

  return <div className="quest-card-slot" inert={flipping} aria-busy={flipping}>
    <article ref={card} className={`quest-card${m.isCompleted ? ' is-complete' : ''}`}>
      <button type="button" className="quest-card-action" disabled={!!loading || !!replacingId || flipping || (m.isCompleted && !onViewSticker)} aria-label={m.isCompleted ? `查看${m.targetChinese}的尋寶成果` : `拍照尋找${m.targetChinese}`} onClick={() => { if (m.isCompleted) onViewSticker?.(m); else { playSfx('pop'); onStartQuest(m); } }}>
        <strong className="quest-word">{m.targetWord}</strong>
        <span className="quest-translation">{m.targetChinese}</span>
        <span className="quest-card-bottom"><span className="quest-hint">{m.hint}</span>{m.isCompleted ? <span className="quest-complete-action"><span className="quest-stamp">找到了 <Check aria-hidden="true" /></span><span className="quest-card-cta">查看單字 <ArrowUpRight aria-hidden="true" /></span></span> : <span className="quest-card-cta">拍這個 <ArrowUpRight aria-hidden="true" /></span>}</span>
      </button>
      {onReplace && !m.isCompleted && <div className="quest-replace-row"><button type="button" className="quest-replace" disabled={!!loading || !!replacingId || flipping || m.replaced} aria-label={m.replaced ? `${m.targetChinese}已更換過` : `更換${m.targetChinese}，限一次`} onClick={() => onReplace(m)}><RefreshCw aria-hidden="true" />{m.replaced ? '已更換一次' : '換一個'}</button>{!m.replaced && <span>每個單字可換一次</span>}</div>}
      <IconButton className="quest-speaker" disabled={!!loading} label={`播放 ${m.targetWord} 發音`} onClick={() => speakEnglish(m.targetWord, 0.9)}><Volume2 /></IconButton>
    </article>
  </div>;
}
