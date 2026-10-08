import { AppError } from '@/domain/errors/app-error';
import type { SyncQueueRepository } from '@/domain/offline/sync-operation';
import type { SessionRepository } from '../repositories/session-repository';
import type { ActiveWorkoutSession, SessionReceipt } from '../types/workout-session';

export interface SessionSyncState {
  sessions(): readonly ActiveWorkoutSession[];
  acknowledge(id: string, userId: string, receipt: SessionReceipt): void;
  fail(id: string, userId: string, message: string): void;
}
/** Foreground/reconnect worker; idempotency and effects are enforced server-side. */
export class SessionSyncService {
  private running: Promise<void> | null = null;
  private readonly retries = new Map<string, { attempts: number; after: number; terminal: boolean }>();
  constructor(private readonly repository: SessionRepository, private readonly state: SessionSyncState,
    private readonly now: () => number = Date.now, private readonly onSynced: (userId: string) => void = () => undefined,
    private readonly durable?: { queue: SyncQueueRepository<ActiveWorkoutSession>; canSync: (userId: string) => boolean; timeoutMs?: number }) {}
  sync(userId: string, force = false): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run(userId, force).finally(() => { this.running = null; });
    return this.running;
  }
  private async run(userId: string, force: boolean): Promise<void> {
    if (this.durable) {
      for (const operation of this.durable.queue.list(userId)) {
        if (!this.durable.canSync(userId)) break;
        if (!this.durable.queue.claim(operation.localId, userId, this.now(), force)) continue;
        try {
          const receipt = await this.submit(operation.payload);
          // The persistence adapter atomically saves the receipt and marks the
          // queue row synced. If that write fails, retry the same remote ID.
          this.state.acknowledge(operation.localId, userId, receipt);
          // Cache observers are not part of the durable commit. An observer
          // failure must not turn an already acknowledged operation into failed.
          try { this.onSynced(userId); } catch { /* Reconnect/refresh can reload server state. */ }
        } catch (error) {
          const terminal = error instanceof AppError && ['VALIDATION', 'AUTHORIZATION', 'AUTHENTICATION', 'CONFLICT'].includes(error.code);
          const message = error instanceof Error ? error.message : 'Synchronization failed. Your local workout has been retained.';
          this.durable.queue.fail(operation.localId, userId, message, !terminal, this.now());
          this.state.fail(operation.localId, userId, message);
        }
      }
      return;
    }
    const queue = this.state.sessions().filter((session) => session.userId === userId && session.submittedAt !== null && session.syncStatus !== 'synced')
      .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    for (const session of queue) {
      const retry = this.retries.get(session.id);
      if (!force && retry && (retry.terminal || retry.after > this.now())) continue;
      try {
        const receipt = await this.repository.sync(session);
        this.state.acknowledge(session.id, userId, receipt);
        this.retries.delete(session.id);
        try { this.onSynced(userId); } catch { /* Observers cannot undo a committed receipt. */ }
      } catch (error) {
        const attempts = (retry?.attempts ?? 0) + 1;
        const terminal = error instanceof AppError && ['VALIDATION', 'AUTHORIZATION', 'AUTHENTICATION', 'CONFLICT'].includes(error.code);
        this.retries.set(session.id, { attempts, terminal, after: this.now() + Math.min(300000, 5000 * 2 ** Math.min(attempts - 1, 6)) });
        this.state.fail(session.id, userId, error instanceof Error ? error.message : 'Synchronization failed. Your local workout has been retained.');
      }
    }
  }
  private async submit(session: ActiveWorkoutSession): Promise<SessionReceipt> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.repository.sync(session, controller.signal),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new AppError('Synchronization timed out. Your workout is saved and will retry.', 'NETWORK'));
          }, this.durable?.timeoutMs ?? 30000);
        }),
      ]);
    } finally { if (timeout !== undefined) clearTimeout(timeout); }
  }
}
