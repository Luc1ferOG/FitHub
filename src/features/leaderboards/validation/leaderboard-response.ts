import { z } from 'zod';
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const entry = z.object({ user_id:uuid,display_name:z.string(),username:z.string(),avatar_url:z.string().nullable(),value:z.number().finite().nonnegative(),rank:z.number().int().positive() });
export const leaderboardResponse = z.object({ title:z.string(),metric:z.enum(['workout_count','volume_kg','repetitions','duration_seconds','distance_m']),
  target:z.number().finite().positive().nullable(),version:z.string().min(1),participant_count:z.number().int().nonnegative(),sharing:z.boolean().nullable(),
  me:entry.nullable(),podium:z.array(entry).max(3),entries:z.array(entry).max(21) });
