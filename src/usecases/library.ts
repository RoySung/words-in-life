import { AppError, type ChangeSet, type LibraryRepository, type LibrarySnapshot, type OperationResult, type PreparedPhoto } from '../repository/LibraryRepository';
export interface Decision { changes: ChangeSet; result: OperationResult }
export interface Dependencies { now: () => number; createId: () => string }
export function createExecutor(repository: LibraryRepository) {
  return async (commandId: string, photos: PreparedPhoto[], decide: (snapshot: LibrarySnapshot) => Decision | null, signal?: AbortSignal) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal?.throwIfAborted();
      const snapshot = await repository.read();
      const decision = decide(snapshot);
      if (!decision) return { snapshot, result: undefined };
      signal?.throwIfAborted();
      const committed = await repository.commit({ commandId, expectedRevision: snapshot.revision, photos, ...decision });
      if (committed.kind !== 'conflict') return { snapshot: await repository.read(), result: committed.result };
    }
    throw new AppError('Conflict');
  };
}
export type Execute = ReturnType<typeof createExecutor>;
