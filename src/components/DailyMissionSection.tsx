import { ArrowUpRight, Check, Volume2 } from 'lucide-react';
import type { DailyMission } from '../types';
import { IconButton } from '../design-system/components';
import { speakEnglish, playSfx } from '../utils/audio';

interface Props {
  missions: DailyMission[];
  onStartQuest: (mission: DailyMission) => void;
  onViewSticker?: (mission: DailyMission) => void;
  streakCount: number;
  loading?: boolean;
  notice?: string;
}

export function DailyMissionSection({ missions, onStartQuest, onViewSticker, streakCount, loading, notice }: Props) {
  const completed = missions.filter(m => m.isCompleted);
  const allDone = missions.length > 0 && completed.length === missions.length;
  return <section className="home-section daily-quest" aria-busy={!!loading}>
    <p className="quest-intro">看到哪個，就拍哪個。</p>
    {streakCount > 0 && <p className="muted">連續探索 {streakCount} 天</p>}
    <div className="quest-progress" role="status"><span>今天找到：</span><span className="quest-dots" aria-hidden="true">{missions.map((m, i) => <i key={m.id} className={i < completed.length ? 'is-filled' : ''} />)}</span><span>{completed.length} / {missions.length}</span></div>
    {completed.length > 0 && <p className="quest-cheer" role="status">{allDone ? '今天全部找到了！' : `找到 ${completed.length} 樣了！`}</p>}
    {!missions.length && <p className="muted" role="status">{loading ? '正在準備今天的尋寶…' : '今天的任務準備好後，就能開始尋寶。'}</p>}
    <div className="quest-cards">{missions.map(m => <article className={`quest-card${m.isCompleted ? ' is-complete' : ''}`} key={m.id}>
      <button type="button" className="quest-card-action" disabled={!!loading || (m.isCompleted && !onViewSticker)} aria-label={m.isCompleted ? `查看${m.targetChinese}的尋寶成果` : `拍照尋找${m.targetChinese}`} onClick={() => { if (m.isCompleted) onViewSticker?.(m); else { playSfx('pop'); onStartQuest(m); } }}>
        <strong className="quest-word">{m.targetWord}</strong>
        <span className="quest-translation">{m.targetChinese}</span>
        <span className="quest-card-bottom"><span className="quest-hint">{m.hint}</span>{m.isCompleted ? <span className="quest-complete-action"><span className="quest-stamp">找到了 <Check aria-hidden="true" /></span><span className="quest-card-cta">查看單字 <ArrowUpRight aria-hidden="true" /></span></span> : <span className="quest-card-cta">拍這個 <ArrowUpRight aria-hidden="true" /></span>}</span>
      </button>
      <IconButton className="quest-speaker" label={`播放 ${m.targetWord} 發音`} onClick={() => speakEnglish(m.targetWord, 0.9)}><Volume2 /></IconButton>
    </article>)}</div>
    {allDone && <p className="muted quest-finish">點選喇叭，聽聽今天找到的單字。明天再來找找看！</p>}
    {notice && <details className="quest-notice"><summary>關於今天的任務</summary><p>{notice}</p></details>}
  </section>;
}
