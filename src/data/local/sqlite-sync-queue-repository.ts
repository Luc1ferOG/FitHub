import type { SyncOperation, SyncQueueRepository, SyncStatus } from '@/domain/offline/sync-operation';
import type { OfflineDatabase } from './offline-database';
import { sessionStorageSchema } from '@/features/workouts/validation/session-schema';
import type { ActiveWorkoutSession } from '@/features/workouts/types/workout-session';

type QueueRow = { local_id: string; user_id: string; payload: string; created_at: number;
  retry_count: number; sync_status: SyncStatus; next_attempt_at: number; retryable: number; error: string | null };

export class SQLiteSyncQueueRepository implements SyncQueueRepository<ActiveWorkoutSession> {
  constructor(private readonly db: OfflineDatabase) {}
  list(userId: string): SyncOperation<ActiveWorkoutSession>[] {
    return this.db.all<QueueRow>("SELECT * FROM sync_queue WHERE user_id=? AND sync_status != 'synced' ORDER BY created_at,local_id", userId).map((row) => ({
      localId: row.local_id, userId: row.user_id, type: 'complete-workout', entity: 'workout-session',
      payload: sessionStorageSchema.parse({ version: 1, sessions: [JSON.parse(row.payload) as unknown] }).sessions[0]!,
      createdAt: row.created_at, retryCount: row.retry_count, syncStatus: row.sync_status,
      nextAttemptAt: row.next_attempt_at, retryable: row.retryable === 1, error: row.error,
    }));
  }
  claim(localId: string, userId: string, now: number, force: boolean): boolean {
    let claimed = false;
    this.db.transaction(() => {
      const row = this.db.first<QueueRow>('SELECT * FROM sync_queue WHERE local_id=? AND user_id=?', localId, userId);
      if (!row || row.sync_status === 'synced' || row.sync_status === 'syncing' || (!force && (!row.retryable || row.next_attempt_at > now))) return;
      this.db.run("UPDATE sync_queue SET sync_status='syncing' WHERE local_id=? AND user_id=?", localId, userId);
      claimed = true;
    });
    return claimed;
  }
  fail(localId: string, userId: string, message: string, retryable: boolean, now: number): void {
    this.db.transaction(() => {
      const row = this.db.first<{ retry_count: number }>('SELECT retry_count FROM sync_queue WHERE local_id=? AND user_id=?', localId, userId);
      if (!row) return;
      const count = row.retry_count + 1;
      const delay = Math.min(300000, 5000 * 2 ** Math.min(count - 1, 6));
      this.db.run("UPDATE sync_queue SET sync_status='failed', retry_count=?,next_attempt_at=?,retryable=?,error=? WHERE local_id=? AND user_id=?",
        count, now + delay, retryable ? 1 : 0, message, localId, userId);
    });
  }
}
