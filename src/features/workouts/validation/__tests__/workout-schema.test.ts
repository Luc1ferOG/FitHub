import { input } from '../../testing/fixtures';
import { workoutSchema } from '../workout-schema';

describe('workout validation', () => {
  it('accepts a complete workout and trims its name', () => {
    expect(workoutSchema.parse({ ...input, name: ' Strength A ' }).name).toBe('Strength A');
  });
  it.each([{ name: ' ' }, { exercises: [] }, { estimatedDuration: -1 }, { estimatedDuration: 86401 }])('rejects invalid details %p', (change) => {
    expect(workoutSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it.each([{ sets: 0 }, { sets: 1.5 }, { reps: -1 }, { reps: 0 }, { weight: -1 }, { weight: Infinity }, { weight: NaN }, { restSeconds: -1 }, { exerciseId: 'invalid' }])('rejects nonsensical exercise values %p', (change) => {
    expect(workoutSchema.safeParse({ ...input, exercises: [{ ...input.exercises[0], ...change }] }).success).toBe(false);
  });
  it('accepts zero rest and optional weight and duration', () => {
    expect(workoutSchema.safeParse({ ...input, estimatedDuration: null, exercises: [{ ...input.exercises[0], restSeconds: 0, weight: null }] }).success).toBe(true);
  });
});
