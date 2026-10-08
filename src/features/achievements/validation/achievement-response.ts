import { z } from 'zod';
export const achievementResponse = z.object({
  entries: z.array(z.object({
    id: z.uuid(), code: z.string(), title: z.string(), description: z.string(), icon: z.string(),
    category: z.enum(['consistency', 'streaks', 'strength', 'social', 'volume']),
    metric: z.enum(['workout_count', 'streak_days', 'personal_records', 'friend_count', 'challenges_joined', 'challenges_completed', 'challenge_wins', 'total_volume']),
    target: z.number().finite().positive(), current: z.number().finite().nonnegative(),
    unlockedAt: z.string().nullable(), presentedAt: z.string().nullable(), active: z.boolean(),
  })),
});
