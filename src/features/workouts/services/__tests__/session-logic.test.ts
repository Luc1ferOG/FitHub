import { makeSession } from '../../testing/session-fixtures';
import { sessionRecords, sessionTotals, updateSession } from '../session-logic';

describe('active workout logging', () => {
  it('adds/removes sets and preserves original configuration', () => {
    const session = makeSession(); const exercise = session.exercises[0];
    if (!exercise) throw new Error('Missing fixture');
    const added = updateSession(session, { type: 'add-set', exerciseId: exercise.id, id: 'new' });
    expect(added.exercises[0]?.sets).toHaveLength(4);
    expect(session.exercises[0]?.sets).toHaveLength(3);
    expect(updateSession(added, { type: 'remove-set', exerciseId: exercise.id, setId: 'new' }).exercises[0]?.sets).toHaveLength(3);
  });
  it('completes a set, calculates volume, detects PRs and starts rest', () => {
    const session = makeSession(); const exercise = session.exercises[0], set = exercise?.sets[0];
    if (!exercise || !set) throw new Error('Missing fixture');
    const completed = updateSession(session, { type: 'toggle-set', exerciseId: exercise.id, setId: set.id, now: session.startedAt + 1000 });
    expect(sessionTotals(completed, session.startedAt + 1000)).toMatchObject({ totalSets: 1, totalReps: 10, volume: 200 });
    expect(sessionRecords(completed).records).toHaveLength(1);
    expect(completed.restEndsAt).toBe(session.startedAt + 61000);
    const extended = updateSession(completed, { type: 'extend-rest', now: session.startedAt + 2000 });
    expect(extended.restEndsAt).toBe(session.startedAt + 91000);
    expect(updateSession(extended, { type: 'skip-rest' }).restEndsAt).toBeNull();
  });
  it('rejects invalid completion and does not mutate the saved set', () => {
    const session = makeSession(); const exercise = session.exercises[0], set = exercise?.sets[0];
    if (!exercise || !set) throw new Error('Missing fixture');
    const invalid = updateSession(session, { type: 'set-value', exerciseId: exercise.id, setId: set.id, field: 'weight', value: '-1' });
    expect(() => updateSession(invalid, { type: 'toggle-set', exerciseId: exercise.id, setId: set.id, now: session.startedAt })).toThrow();
    expect(set.completedAt).toBeNull();
  });
});
