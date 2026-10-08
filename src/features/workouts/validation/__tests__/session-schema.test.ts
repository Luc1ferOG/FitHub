import { makeSession, receipt } from '../../testing/session-fixtures';
import { sessionStorageSchema } from '../session-schema';

describe('durable workout validation', () => {
  it('round-trips a draft containing incomplete editable inputs', () => {
    const session = makeSession();
    const set = session.exercises[0]?.sets[0]; if (!set) throw new Error('Missing set');
    set.weight = ''; set.reps = '';
    expect(sessionStorageSchema.parse(JSON.parse(JSON.stringify({ version: 1, sessions: [session] })))).toEqual({ version: 1, sessions: [session] });
  });
  it.each(['duplicate-session', 'duplicate-set', 'two-active-sessions', 'invalid-completed-set', 'completion-before-start', 'synced-without-receipt'] as const)('rejects %s instead of restoring unsafe data', (invalid) => {
    const session = makeSession(); const exercise = session.exercises[0]; const set = exercise?.sets[0];
    if (!exercise || !set) throw new Error('Missing fixture');
    const sessions = [session];
    if (invalid === 'duplicate-session') sessions.push(session);
    if (invalid === 'duplicate-set') exercise.sets.push({ ...set });
    if (invalid === 'two-active-sessions') sessions.push({ ...session, id: '89000000-0000-0000-0000-000000000001' });
    if (invalid === 'invalid-completed-set') { set.completedAt = session.startedAt + 1000; set.reps = '-1'; }
    if (invalid === 'completion-before-start') session.completedAt = session.startedAt - 1;
    if (invalid === 'synced-without-receipt') { session.syncStatus = 'synced'; session.completedAt = session.startedAt; session.submittedAt = session.startedAt; }
    expect(sessionStorageSchema.safeParse({ version: 1, sessions }).success).toBe(false);
  });
  it('restores a submitted acknowledged session only with its receipt', () => {
    const session = { ...makeSession(), completedAt: Date.UTC(2026, 9, 6, 12, 1), submittedAt: Date.UTC(2026, 9, 6, 12, 2), syncStatus: 'synced' as const, receipt };
    expect(sessionStorageSchema.safeParse({ version: 1, sessions: [session] }).success).toBe(true);
  });
});
