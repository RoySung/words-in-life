import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AnalysisResult, DailyMission, RecognitionFailureInfo, SampleScene } from '../../types';
import { playSfx } from '../../utils/audio';
import type { RecognitionUsecases } from '../../usecases/recognition';
import { AppError } from '../../repository/LibraryRepository';
import { errorMessage } from '../../utils/errorMessage';

type RecognitionState =
  | { kind: 'idle' }
  | { kind: 'analyzing'; imageUrl: string; fromCamera: boolean }
  | { kind: 'scene'; result: AnalysisResult }
  | { kind: 'failure'; failure: RecognitionFailureInfo };

export function useRecognition(usecases: RecognitionUsecases) {
  const [state, setState] = useState<RecognitionState>({ kind: 'idle' });
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const print = useRef<(() => void) | null>(null);
  const cancel = () => { generation.current++; controller.current?.abort(); print.current?.(); print.current = null; };
  const reset = () => { cancel(); setState({ kind: 'idle' }); };
  useEffect(() => () => cancel(), []);
  const run = async ({ imageUrl, sample, fromCamera = false, quest, onResult }: {
    imageUrl: string; sample?: SampleScene; fromCamera?: boolean; quest?: DailyMission | null;
    onResult: (result: AnalysisResult, isCurrent: () => boolean, signal: AbortSignal) => Promise<void>;
  }) => {
    cancel();
    const request = generation.current;
    const abort = new AbortController(); controller.current = abort;
    const active = () => request === generation.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let printTimer: ReturnType<typeof setTimeout>;
    const printed = new Promise<void>(resolve => {
      print.current = resolve;
      printTimer = setTimeout(resolve, reduced ? 0 : 2400);
    });
    setState({ kind: 'analyzing', imageUrl, fromCamera });
    const finish = async (next: RecognitionState) => {
      await printed;
      if (!active()) return;
      const commit = () => { if (active()) setState(next); };
      if (document.startViewTransition && !reduced) {
        const transition = document.startViewTransition(() => flushSync(commit));
        void transition.finished.catch(() => {});
      } else commit();
    };
    try {
      const response = sample ? await usecases.prepareSampleScene(imageUrl, sample, abort.signal)
        : await usecases.recognizePhoto(imageUrl, abort.signal);
      if (!active()) return;
      if (response.success === false) {
        playSfx('pop');
        await finish({ kind: 'failure', failure: { ...response, photoUrl: imageUrl, activeQuestTarget: quest } });
        return;
      }
      const result: AnalysisResult = response.scene;
      await printed;
      if (!active()) return;
      abort.signal.throwIfAborted();
      await finish({ kind: 'scene', result });
      if (!active()) return;
      await onResult(result, active, abort.signal);
      if (active()) playSfx('success');
    } catch (cause) {
      if (!active()) return;
      const timedOut = cause instanceof AppError && cause.code === 'Timeout';
      await finish({ kind: 'failure', failure: {
        reasonCode: timedOut ? 'NETWORK_ERROR' : 'GENERIC_ERROR',
        title: timedOut ? '辨識連線逾時，網路不穩定' : '辨識服務暫時中斷',
        description: timedOut ? '照片上傳或分析耗時過久，請檢查連線後重試。' : errorMessage(cause),
        photoUrl: imageUrl, activeQuestTarget: quest,
        suggestions: ['檢查 Wi-Fi 或行動網路連線', '重新辨識本圖', '試試生活範例場景'],
      } });
    } finally {
      clearTimeout(printTimer!);
      if (active()) { print.current = null; controller.current = null; }
    }
  };
  return { state, run, reset, finishPrint: () => print.current?.(), showFailure: (failure: RecognitionFailureInfo) => { cancel(); setState({ kind: 'failure', failure }); } };
}
