import { z } from 'zod';

export const publicUserResponse = z.object({ id: z.string(), username: z.string(), display_name: z.string(),
  avatar_url: z.string().nullable(), bio: z.string().nullable(), experience_level: z.string() });
export const friendshipResponse = z.object({ id: z.string(), requester_id: z.string(), addressee_id: z.string(),
  status: z.enum(['pending', 'accepted', 'declined']), created_at: z.string() });
export const profileResponse = z.object({ profile: publicUserResponse, public_workout_count: z.number().nonnegative(),
  achievement_count: z.number().nonnegative(), achievements: z.array(z.object({ code: z.string(), title: z.string(), icon: z.string(), unlocked_at: z.string() })) });
export const friendListResponse = z.array(z.object({ profile: publicUserResponse, friendship: friendshipResponse }));
export const searchResponse = z.array(publicUserResponse);
