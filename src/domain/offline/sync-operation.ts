export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type SyncOperation<Payload = unknown> = {
  localId: string;
  userId: string;
  type: 'complete-workout';
  entity: 'workout-session';
  payload: Payload;
  createdAt: number;
  retryCount: number;
  syncStatus: SyncStatus;
  nextAttemptAt: number;
  retryable: boolean;
  error: string | null;
};

export interface SyncQueueRepository<Payload = unknown> {
  list(userId: string): SyncOperation<Payload>[];
  claim(localId: string, userId: string, now: number, force: boolean): boolean;
  fail(localId: string, userId: string, message: string, retryable: boolean, now: number): void;
}
