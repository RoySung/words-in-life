import { createMissionContext, generatedMissions } from '../domain/missionGeneration';
import { getTodayDateKey, lockMissions, rollDate, type MissionFallbackReason } from '../domain/missions';
import { AppError, type LibraryRepository, type LibrarySnapshot } from '../repository/LibraryRepository';
import type { MissionGenerationRepository } from '../repository/MissionGenerationRepository';
import { createExecutor, type Dependencies } from './library';

export function createMissionGenerationUsecases(repository: LibraryRepository, generator: MissionGenerationRepository,
  deps: Dependencies & { timeZone: () => string; timeoutMs?: number }) {
  const execute = createExecutor(repository);
  const timeoutMs = deps.timeoutMs ?? 25000;
  const pending = new Map<string, Promise<LibrarySnapshot>>();
  const controllers = new Set<AbortController>();
  let closed = false;
  async function generate(dateKey: string) {
    const requestId = deps.createId();
    const startedAt = deps.now();
    // Claim the day atomically before making a paid request. Expired claims settle
    // to fallback rather than sending the same day's data again after a reload.
    const claim = await execute(requestId, [], snapshot => {
      if (closed || getTodayDateKey(new Date(deps.now())) !== dateKey) return null;
      const current = rollDate(snapshot.daily, dateKey);
      const generation = current.generation;
      let daily = current;
      if (current.missions.some(m => m.isCompleted)) daily = lockMissions(current, startedAt, 'started');
      else if (generation?.status === 'generating') {
        if (startedAt - generation.startedAt >= timeoutMs + 5000) daily = lockMissions(current, startedAt, 'interrupted');
      } else if (generation?.status !== 'ready') {
        daily = { ...current, generation: { status: 'generating', requestId, startedAt } };
      }
      return daily === snapshot.daily ? null : { changes: { daily }, result: { kind: 'day' } };
    });
    const generation = claim.snapshot.daily.generation;
    if (closed || generation?.status !== 'generating' || generation.requestId !== requestId || claim.snapshot.daily.dateKey !== dateKey) return claim.snapshot;
    const context = createMissionContext(claim.snapshot.words, dateKey, deps.timeZone());
    const controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(new AppError('Timeout')), timeoutMs);
    let detach = () => {};
    let missions: ReturnType<typeof generatedMissions> = null;
    let fallbackReason: MissionFallbackReason = 'generation-failed';
    try {
      const cancelled = new Promise<never>((_, reject) => {
        const onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', onAbort, { once: true });
        detach = () => controller.signal.removeEventListener('abort', onAbort);
      });
      const drafts = await Promise.race([generator.generate(context, { signal: controller.signal }), cancelled]);
      missions = generatedMissions(drafts, dateKey, claim.snapshot.words, context);
    } catch (cause) {
      if (cause instanceof AppError && cause.code === 'MissingCredential') fallbackReason = 'missing-key';
    } finally {
      clearTimeout(timer); detach(); controllers.delete(controller);
    }
    if (closed) return claim.snapshot;
    const result = await execute(deps.createId(), [], snapshot => {
      const active = snapshot.daily.generation;
      if (getTodayDateKey(new Date(deps.now())) !== dateKey || snapshot.daily.dateKey !== dateKey ||
        active?.status !== 'generating' || active.requestId !== requestId || snapshot.daily.missions.some(m => m.isCompleted)) return null;
      // A collection edit while waiting may make a proposed new word known.
      const finalMissions = missions && generatedMissions(missions, dateKey, snapshot.words, context);
      const daily = finalMissions
        ? { ...snapshot.daily, missions: finalMissions, generation: { status: 'ready' as const, source: 'ai' as const, generatedAt: deps.now() } }
        : lockMissions(snapshot.daily, deps.now(), fallbackReason);
      return { changes: { daily }, result: { kind: 'day' } };
    });
    return result.snapshot;
  }
  return {
    ensure() {
      if (closed) return Promise.reject(new AppError('Cancelled'));
      const dateKey = getTodayDateKey(new Date(deps.now()));
      const existing = pending.get(dateKey);
      if (existing) return existing;
      const work = generate(dateKey).finally(() => { if (pending.get(dateKey) === work) pending.delete(dateKey); });
      pending.set(dateKey, work);
      return work;
    },
    close() { closed = true; controllers.forEach(controller => controller.abort(new AppError('Cancelled'))); },
  };
}
