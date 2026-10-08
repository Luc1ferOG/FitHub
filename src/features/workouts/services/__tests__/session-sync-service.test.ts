import { AppError } from '@/domain/errors/app-error';
import type { SessionRepository } from '../../repositories/session-repository';
import { LocalSessionRepository } from '../../repositories/local-session-repository';
import { createSessionStore } from '../../state/create-session-store';
import { makeSession, receipt, SESSION_OWNER } from '../../testing/session-fixtures';
import { updateSession } from '../session-logic';
import { SessionSyncService } from '../session-sync-service';

function setup() {
  const memory = new Map<string, string>();
  const store = createSessionStore(new LocalSessionRepository({ getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } }));
  store.getState().restore(); let session = makeSession();
  const exercise = session.exercises[0], set = exercise?.sets[0]; if (!exercise || !set) throw new Error('Missing fixture');
  session = updateSession(session, { type: 'toggle-set', exerciseId: exercise.id, setId: set.id, now: session.startedAt + 1000 });
  session = updateSession(session, { type: 'review', now: session.startedAt + 60000 });
  session = updateSession(session, { type: 'submit', now: session.startedAt + 65000 }); store.getState().start(session);
  const repository: jest.Mocked<SessionRepository> = { history: jest.fn(), sync: jest.fn().mockResolvedValue(receipt) };
  const worker = new SessionSyncService(repository, { sessions: () => store.getState().sessions,
    acknowledge: (id, owner, result) => store.getState().acknowledge(id, owner, result),
    fail: (id, owner, message) => store.getState().fail(id, owner, message) });
  return { store, repository, worker, session };
}
describe('session synchronization', () => {
  it('does not fail an acknowledged legacy session when cache invalidation throws', async () => {
    const { repository, store } = setup();
    const observer = jest.fn(() => { throw new Error('cache observer'); });
    const worker = new SessionSyncService(repository, { sessions: () => store.getState().sessions,
      acknowledge: (id, owner, result) => store.getState().acknowledge(id, owner, result),
      fail: (id, owner, message) => store.getState().fail(id, owner, message) }, Date.now, observer);
    await worker.sync(SESSION_OWNER);
    expect(observer).toHaveBeenCalledWith(SESSION_OWNER);
    expect(store.getState().sessions[0]?.syncStatus).toBe('synced');
  });
  it('does not automatically retry a legacy session rejected for authentication', async () => {
    const { repository, worker } = setup();
    repository.sync.mockRejectedValue(new AppError('Sign in again.', 'AUTHENTICATION'));
    await worker.sync(SESSION_OWNER); await worker.sync(SESSION_OWNER);
    expect(repository.sync).toHaveBeenCalledTimes(1);
  });
  it('shares an in-flight request and records confirmed server rewards', async () => {
    const { repository, worker, store } = setup();
    await Promise.all([worker.sync(SESSION_OWNER), worker.sync(SESSION_OWNER)]);
    expect(repository.sync).toHaveBeenCalledTimes(1);
    expect(store.getState().sessions[0]).toMatchObject({ syncStatus: 'synced', receipt });
  });
  it('retains failed sessions and retries the same identity', async () => {
    const { repository, worker, store, session } = setup();
    repository.sync.mockRejectedValueOnce(new Error('Response lost'));
    await worker.sync(SESSION_OWNER);
    expect(store.getState().sessions[0]?.syncStatus).toBe('failed');
    await worker.sync(SESSION_OWNER, true);
    expect(repository.sync.mock.calls.map(([value]) => value.id)).toEqual([session.id, session.id]);
    expect(store.getState().sessions[0]?.syncStatus).toBe('synced');
  });
  it('never synchronizes another account and does not blindly retry terminal errors', async () => {
    const { repository, worker } = setup();
    await worker.sync('other'); expect(repository.sync).not.toHaveBeenCalled();
    repository.sync.mockRejectedValue(new AppError('Invalid timestamps', 'VALIDATION'));
    await worker.sync(SESSION_OWNER); await worker.sync(SESSION_OWNER);
    expect(repository.sync).toHaveBeenCalledTimes(1);
  });
});
