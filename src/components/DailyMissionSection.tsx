import React from 'react';
import { Target, Volume2, CheckCircle2, Camera, Sparkles, Flame, Trophy, ChevronRight, Eye } from 'lucide-react';
import { DailyMission } from '../types';
import { speakEnglish, playSfx } from '../utils/audio';
import { Mascot } from './Mascot';

interface DailyMissionSectionProps {
  missions: DailyMission[];
  onStartQuest: (mission: DailyMission) => void;
  onViewSticker?: (mission: DailyMission) => void;
  streakCount: number;
}

export const DailyMissionSection: React.FC<DailyMissionSectionProps> = ({
  missions,
  onStartQuest,
  onViewSticker,
  streakCount,
}) => {
  const completedCount = missions.filter((m) => m.isCompleted).length;
  const isAllCompleted = missions.length > 0 && completedCount === missions.length;
  const progressPercent = missions.length > 0 ? (completedCount / missions.length) * 100 : 0;

  const handlePlayAudio = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    playSfx('pop');
    speakEnglish(word, 0.9);
  };

  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white border-2 border-orange-200/90 p-5 shadow-sm space-y-4 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-orange-300/20 blur-2xl pointer-events-none"></div>

      {/* Header with Title and Streak */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-orange-500/25">
            <Target className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-stone-900 tracking-tight">每日拍照尋寶</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold tracking-wide">
                Daily Quest
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">拍下生活中的目標物品來解鎖單字！</p>
          </div>
        </div>

        {/* Streak Flame Badge */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-orange-200/80 shadow-xs text-orange-600 font-black text-xs">
          <Flame className="w-4 h-4 fill-orange-500 text-orange-500 animate-bounce" />
          <span>{streakCount} 天</span>
        </div>
      </div>

      {/* Progress Bar & Status */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-stone-700">今日尋寶進度</span>
          <span className="font-extrabold text-orange-600">
            {completedCount} / {missions.length} 完成
          </span>
        </div>
        <div className="w-full bg-stone-200/80 rounded-full h-2.5 overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 h-full rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* When All 3 Completed: Special Congratulations Banner */}
      {isAllCompleted && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 p-3.5 text-white flex items-center justify-between shadow-md shadow-orange-500/20 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <Mascot variant="cheering" className="w-12 h-12 flex-shrink-0" />
            <div>
              <p className="font-black text-sm flex items-center gap-1.5">
                <Trophy className="w-4 h-4 fill-white" />
                <span>太棒了！今日尋寶全數達成！</span>
              </p>
              <p className="text-[11px] text-white/90">你成功把 3 個真實生活物品變成了英文單字！</p>
            </div>
          </div>
        </div>
      )}

      {/* Mission Cards List */}
      <div className="flex flex-col gap-2.5">
        {missions.map((mission, index) => {
          return (
            <div
              key={mission.id}
              className={`rounded-2xl p-3.5 border transition-all duration-200 ${
                mission.isCompleted
                  ? 'bg-white/90 border-emerald-200/90 shadow-xs'
                  : 'bg-white border-orange-100/90 shadow-sm hover:border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Quest Target Details & Sticker */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Sticker or Target Icon */}
                  {mission.isCompleted && mission.completedStickerUrl ? (
                    <div
                      onClick={() => onViewSticker && onViewSticker(mission)}
                      className="relative w-12 h-12 rounded-xl p-0.5 bg-white shadow-md border-2 border-white ring-1 ring-emerald-500/30 flex-shrink-0 cursor-pointer -rotate-2 hover:rotate-0 transition-transform active:scale-95 overflow-hidden"
                      title="點擊查看你拍下的貼紙"
                    >
                      <img
                        src={mission.completedStickerUrl}
                        alt={mission.targetWord}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 text-white rounded-tl-md flex items-center justify-center">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-2xl flex-shrink-0">
                      {mission.emoji}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-stone-900 text-base tracking-tight truncate">
                        {mission.targetWord}
                      </span>
                      <span className="font-mono text-xs text-stone-400">{mission.phonetic}</span>
                      <button
                        onClick={(e) => handlePlayAudio(e, mission.targetWord)}
                        className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center active:scale-90 transition hover:bg-blue-100 flex-shrink-0"
                        title="聽發音"
                        aria-label="發音"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-bold text-orange-600">{mission.targetChinese}</span>
                    </div>

                    <p className="text-[11px] text-stone-500 truncate mt-0.5">💡 {mission.hint}</p>
                  </div>
                </div>

                {/* Right: Action or Status */}
                <div className="flex-shrink-0">
                  {mission.isCompleted ? (
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>已達成</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        playSfx('pop');
                        onStartQuest(mission);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>去拍照</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5 -mr-1" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
