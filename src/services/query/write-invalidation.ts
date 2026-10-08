export type WriteEvent = 'workout-template' | 'workout-session' | 'friendship' | 'challenge' | 'achievement';

const dependencies: Readonly<Record<WriteEvent, readonly string[]>> = {
  'workout-template': ['home-dashboard'],
  'workout-session': ['workout-history', 'sessions', 'achievements', 'challenges', 'leaderboards', 'home-dashboard'],
  friendship: ['achievements', 'leaderboards', 'home-dashboard'],
  challenge: ['leaderboards', 'home-dashboard'],
  achievement: ['home-dashboard'],
};

/** Invalidate dependent aggregates without refetching another account's cache. */
export function writeInvalidationKeys(event: WriteEvent, owner: string): readonly (readonly string[])[] {
  return owner ? dependencies[event].map((root) => [root, owner]) : [];
}
