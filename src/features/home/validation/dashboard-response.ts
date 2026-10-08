import { z } from 'zod';
const count = z.number().finite().nonnegative();
export const dashboardResponse = z.object({
  generatedAt: z.string(), localDay: z.string(),
  profile: z.object({ displayName: z.string(), units: z.enum(['metric', 'imperial']) }).nullable(),
  today: z.object({ workouts: count }),
  week: z.object({ workouts: count, durationSeconds: count, volumeKg: count }),
  activeChallengeCount: count,
  templates: z.array(z.object({ id: z.uuid(), name: z.string(), estimated_duration: count.nullable(), updated_at: z.string() })).max(3),
  challenges: z.array(z.object({ id: z.uuid(), title: z.string(), target_value: z.number().finite().positive(), current_value: count,
    metric_type: z.enum(['workout_count', 'volume_kg', 'repetitions', 'duration_seconds', 'distance_m']), end_date: z.string() })).max(3),
  latestAchievement: z.object({ title: z.string(), description: z.string(), unlockedAt: z.string() }).nullable(),
  activity: z.array(z.object({ id: z.string(), kind: z.enum(['workout', 'friend_achievement', 'challenge_update']), title: z.string(), detail: z.string(), occurred_at: z.string(), user_id: z.uuid().nullable() })).max(8),
});
