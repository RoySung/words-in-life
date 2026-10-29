import { freshMissions, getTodayDateKey } from '../domain/missions';
import type { Word } from '../domain/vocabulary';
import type { LibraryRepository, PreparedPhoto } from '../repository/LibraryRepository';
import { createExecutor, type Dependencies } from './library';
import { collectionUsecases } from './collection';
import { missionUsecases } from './missions';
export function createLibraryUsecases(repository: LibraryRepository, deps: Dependencies) {
  const execute = createExecutor(repository);
  return {
    ...collectionUsecases(execute, deps), ...missionUsecases(execute, deps),
    initialize: async (seed: () => Promise<{ words: Word[]; photos: PreparedPhoto[] }>) => {
      const current = await repository.read();
      if (current.initialized) return current;
      const initial = await seed();
      const daily = freshMissions(getTodayDateKey(new Date(deps.now())));
      return (await execute('initialize', initial.photos, state => state.initialized ? null : {
        changes: { putWords: initial.words, daily, initialize: true }, result: { kind: 'initialized' },
      })).snapshot;
    },
    load: () => repository.read(),
    subscribe: (listener: (revision: number) => void) => repository.subscribe(listener),
  };
}
export type LibraryUsecases = ReturnType<typeof createLibraryUsecases>;
