import { makeSession } from '../../testing/session-fixtures';
import { sessionRecords, sessionTotals, setVolume, updateSession } from '../session-logic';

describe('volume, duration and record semantics', () => {
  it('sums decimal weights precisely and ignores unfinished sets', () => {
    const session = makeSession(); const exercise = session.exercises[0];
    if (!exercise) throw new Error('Missing fixture');
    exercise.sets = [
      { id: 'a', weight: '33.33', reps: '3', completedAt: session.startedAt },
      { id: 'b', weight: '0', reps: '20', completedAt: session.startedAt },
      { id: 'c', weight: '-9', reps: '', completedAt: null },
    ];
    expect(sessionTotals(session, session.startedAt)).toMatchObject({ totalSets: 2, totalReps: 23, volume: 99.99, exercisesCompleted: 0 });
    expect(setVolume(exercise.sets[0]!)).toBe(99.99);
  });
  it.each([[999, 0], [1000, 1], [61999, 61], [-1000, 0]])('elapsed %s ms becomes %s seconds', (delta, expected) => {
    const session = makeSession(); expect(sessionTotals(session, session.startedAt + delta).durationSeconds).toBe(expected);
  });
  it('freezes duration after review even if saving/sync is delayed', () => {
    const session = makeSession(); expect(sessionTotals({ ...session, completedAt: session.startedAt + 60000 }, session.startedAt + 900000).durationSeconds).toBe(60);
  });
  it('does not call a tied single-set volume a PR or compare unlike exercises', () => {
    const session = makeSession(); const exercise = session.exercises[0]; if (!exercise) throw new Error('Missing fixture');
    exercise.bestVolume = 200;
    exercise.sets = [
      { id: 'tie', weight: '20', reps: '10', completedAt: session.startedAt + 1000 },
      { id: 'record', weight: '21', reps: '10', completedAt: session.startedAt + 2000 },
      { id: 'later-tie', weight: '21', reps: '10', completedAt: session.startedAt + 3000 },
    ];
    expect(sessionRecords(session)).toMatchObject({ setIds: ['record'], provisional: false });
    exercise.bestVolume = null; expect(sessionRecords(session).provisional).toBe(true);
  });
  it('shares historical maxima across duplicate exercise occurrences', () => {
    const session = makeSession(); const exercise = session.exercises[0]; if (!exercise) throw new Error('Missing fixture');
    exercise.sets = [{ id: 'a', weight: '20', reps: '10', completedAt: session.startedAt }];
    session.exercises.push({ ...exercise, id: 'another occurrence', bestVolume: 500, sets: [] });
    expect(sessionRecords(session).records).toEqual([]);
  });
  it('cannot review an empty workout or a workout before its last completed set', () => {
    const session = makeSession(); const exercise = session.exercises[0], set = exercise?.sets[0]; if (!exercise || !set) throw new Error('Missing fixture');
    expect(() => updateSession(session, { type: 'review', now: session.startedAt + 1000 })).toThrow();
    const logged = updateSession(session, { type: 'toggle-set', exerciseId: exercise.id, setId: set.id, now: session.startedAt + 2000 });
    expect(() => updateSession(logged, { type: 'review', now: session.startedAt + 1000 })).toThrow();
  });
});
