import type { OfflineDatabase } from './offline-database';
import type { ActiveWorkoutSession } from '@/features/workouts/types/workout-session';
import type { SessionPersistence } from '@/features/workouts/repositories/local-session-repository';
import { sessionStorageSchema } from '@/features/workouts/validation/session-schema';
import { AppError } from '@/domain/errors/app-error';

/** Session save + immutable outbox enqueue/ack are one SQLite transaction. */
export class SQLiteSessionRepository implements SessionPersistence {
  private readonly persisted = new Map<string, string>();
  private readonly serialized = new WeakMap<ActiveWorkoutSession, string>();
  constructor(private readonly db: OfflineDatabase, private readonly legacy: SessionPersistence) {}
  restore(): ActiveWorkoutSession[] {
    if (!this.db.first('SELECT key FROM local_metadata WHERE key = ?', 'sessions-v1-imported')) {
      const sessions = this.legacy.restore(); // Validate before touching legacy data.
      this.db.transaction(() => {
        this.saveRows(sessions);
        this.db.run('INSERT INTO local_metadata(key,value) VALUES (?,?)', 'sessions-v1-imported', 'true');
      });
      // Retain the legacy blob for recovery; never read it again after migration.
    }
    const sessions = this.db.all<{ payload: string }>('SELECT payload FROM local_sessions ORDER BY rowid').map((row) => JSON.parse(row.payload) as unknown);
    const restored = sessionStorageSchema.parse({ version: 1, sessions }).sessions;
    this.persisted.clear();
    for (const session of restored) this.persisted.set(session.id, this.encode(session));
    return restored;
  }
  save(sessions: readonly ActiveWorkoutSession[]): void {
    sessionStorageSchema.parse({ version: 1, sessions });
    const changed = sessions.filter((session) => this.persisted.get(session.id) !== this.encode(session));
    this.db.transaction(() => this.saveRows(changed));
    // Do not update this optimization cache before a transaction commits.
    for (const session of changed) this.persisted.set(session.id, this.encode(session));
  }
  // Store actions replace session objects immutably; identity therefore safely
  // caches serialization. Mutating a cached object would conceal unsaved changes.
  private encode(session: ActiveWorkoutSession): string {
    const cached = this.serialized.get(session);
    if (cached) return cached;
    const payload = JSON.stringify(session);
    this.serialized.set(session, payload);
    return payload;
  }
  private saveRows(sessions: readonly ActiveWorkoutSession[]): void {
    for (const session of sessions) {
      const existing = this.db.first<{ user_id: string }>('SELECT user_id FROM local_sessions WHERE id=?', session.id);
      if (existing && existing.user_id !== session.userId) throw new AppError('This session ID belongs to another account.', 'AUTHORIZATION');
      this.db.run('INSERT INTO local_sessions(id,user_id,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload', session.id, session.userId, this.encode(session));
      if (session.submittedAt !== null) {
        this.db.run(`INSERT INTO sync_queue(local_id,user_id,type,entity,payload,created_at,sync_status)
          VALUES (?,?,'complete-workout','workout-session',?,?,?) ON CONFLICT(local_id) DO NOTHING`,
        session.id, session.userId, JSON.stringify(session), session.submittedAt, session.syncStatus === 'synced' ? 'synced' : 'pending');
        if (session.syncStatus === 'synced') {
          this.db.run("UPDATE sync_queue SET sync_status='synced', error=NULL WHERE local_id=? AND user_id=?", session.id, session.userId);
        }
      }
    }
  }
}
