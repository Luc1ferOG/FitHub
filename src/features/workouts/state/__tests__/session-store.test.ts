import { LocalSessionRepository, SESSION_STORAGE_KEY, type SessionStorage } from '../../repositories/local-session-repository';
import { makeSession, SESSION_OWNER } from '../../testing/session-fixtures';
import { createSessionStore } from '../create-session-store';

function setup() {
  const values = new Map<string, string>();
  const storage: SessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  const repository = new LocalSessionRepository(storage);
  const store = createSessionStore(repository); store.getState().restore();
  return { values, storage, repository, store };
}
describe('Zustand offline persistence and restoration', () => {
  it('restores completed sets, notes and rest after a new store is created', () => {
    const { store, repository } = setup(); const session = makeSession();
    const exercise = session.exercises[0], set = exercise?.sets[0];
    if (!exercise || !set) throw new Error('Missing fixture');
    store.getState().start(session);
    store.getState().dispatch(session.id, SESSION_OWNER, { type: 'toggle-set', exerciseId: exercise.id, setId: set.id, now: session.startedAt + 1000 });
    store.getState().dispatch(session.id, SESSION_OWNER, { type: 'notes', value: 'Logged offline' });
    const restored = createSessionStore(repository); restored.getState().restore();
    expect(restored.getState().hydrated).toBe(true);
    expect(restored.getState().sessions).toEqual(store.getState().sessions);
    expect(restored.getState().sessions[0]?.restEndsAt).toBe(session.startedAt + 61000);
  });
  it('retains the prior state when local storage is full', () => {
    const { store, storage, values } = setup(); const session = makeSession(); store.getState().start(session);
    const old = values.get(SESSION_STORAGE_KEY);
    storage.setItem = () => { throw new Error('Disk full'); };
    expect(() => store.getState().dispatch(session.id, SESSION_OWNER, { type: 'notes', value: 'Not saved' })).toThrow();
    expect(store.getState().sessions[0]?.notes).toBe('');
    expect(values.get(SESSION_STORAGE_KEY)).toBe(old);
    expect(store.getState().storageError).toMatch(/Could not save/);
  });
  it('preserves corrupt data and blocks creating an empty replacement', () => {
    const { values, repository } = setup(); values.set(SESSION_STORAGE_KEY, '{broken');
    const store = createSessionStore(repository); store.getState().restore();
    expect(store.getState().hydrated).toBe(false);
    expect(values.get(SESSION_STORAGE_KEY)).toBe('{broken');
    expect(() => store.getState().start(makeSession())).toThrow();
  });
  it('rejects semantically corrupt completed values using real Zod validation', () => {
    const { values, repository } = setup(); const session = makeSession();
    const set = session.exercises[0]?.sets[0]; if (!set) throw new Error('Missing fixture');
    set.weight = '-5'; set.completedAt = session.startedAt;
    values.set(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, sessions: [session] }));
    expect(() => repository.restore()).toThrow(/Stored workout/);
  });
  it('never exposes edits to a different account', () => {
    const { store } = setup(); const session = makeSession(); store.getState().start(session);
    expect(() => store.getState().dispatch(session.id, 'different-account', { type: 'notes', value: 'Changed' })).toThrow();
    expect(store.getState().sessions[0]?.notes).toBe('');
  });
});
