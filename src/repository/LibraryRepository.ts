import type { Word } from '../domain/vocabulary';
import type { MissionState } from '../domain/missions';

export type ErrorCode = 'Unavailable' | 'QuotaExceeded' | 'Conflict' | 'NotFound' | 'InvalidData' | 'Unexpected' | 'Cancelled' | 'Timeout' | 'MissingCredential' | 'Unauthorized' | 'InvalidInput' | 'RateLimited' | 'InvalidResponse';
export class AppError extends Error {
  constructor(public code: ErrorCode, message: string = code, options?: ErrorOptions) { super(message, options); this.name = 'AppError'; }
}
export interface LibrarySnapshot { revision: number; initialized: boolean; words: Word[]; daily: MissionState }
export interface PhotoContent { bytes: Uint8Array; mimeType: string }
export interface PreparedPhoto extends PhotoContent { id: string }
export interface ChangeSet { putWords?: Word[]; removeWords?: string[]; daily?: MissionState; initialize?: boolean }
export interface OperationResult { kind: 'initialized' | 'saved' | 'removed' | 'reviewed' | 'day' | 'mission'; wordId?: string; missionId?: string; matchedItemId?: string }
export interface CommitRequest { commandId: string; expectedRevision: number; changes: ChangeSet; photos: PreparedPhoto[]; result: OperationResult }
export type CommitResult = { kind: 'committed' | 'alreadyApplied'; revision: number; result: OperationResult } | { kind: 'conflict' };
export interface LibraryRepository {
  read(): Promise<LibrarySnapshot>;
  commit(request: CommitRequest): Promise<CommitResult>;
  readPhoto(id: string): Promise<PhotoContent>;
  subscribe(listener: (revision: number) => void): () => void;
  close(): void;
}
