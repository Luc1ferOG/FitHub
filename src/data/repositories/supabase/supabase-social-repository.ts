import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import type { SocialRepository } from '@/features/social/repositories/social-repository';
import type { Friendship } from '@/features/social/types/friendship';
import type { FriendAction, FriendListKind, SocialPage } from '@/features/social/types/social';
import { friendListResponse, friendshipResponse, profileResponse, publicUserResponse, searchResponse } from '@/features/social/validation/social-response';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type UserRow = ReturnType<typeof publicUserResponse.parse>;
type FriendRow = ReturnType<typeof friendshipResponse.parse>;
export function mapPublicUser(row: UserRow) {
  return { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, bio: row.bio, experienceLevel: row.experience_level };
}
export function mapFriendship(row: FriendRow): Friendship {
  return { id: row.id, requesterId: row.requester_id, addresseeId: row.addressee_id, status: row.status, createdAt: row.created_at };
}
export function socialPage<T>(rows: T[], offset: number): SocialPage<T> {
  return { items: rows.slice(0, 20), nextOffset: rows.length > 20 && offset < 10000 ? offset + 20 : null };
}
function checkError(error: { code?: string; message: string } | null): void {
  if (!error) return;
  const conflict = error.code === '23505' || error.code === '40001';
  throw new AppError(conflict ? 'The friendship changed. Refresh and try again.' : error.code === '42501' ? 'You cannot perform this friend action.' : 'Could not connect to FitHub. Please try again.',
    conflict ? 'CONFLICT' : error.code === '42501' ? 'AUTHORIZATION' : 'NETWORK', { cause: error });
}
export class SupabaseSocialRepository implements SocialRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async search(search: string, offset: number, signal?: AbortSignal) {
    let query = this.client.rpc('search_social_users', { p_search: search, p_offset: offset });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; checkError(error);
    return socialPage(searchResponse.parse(data).map(mapPublicUser), offset);
  }
  async list(kind: FriendListKind, offset: number, signal?: AbortSignal) {
    let query = this.client.rpc('list_social_friends', { p_kind: kind, p_offset: offset });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; checkError(error);
    return socialPage(friendListResponse.parse(data).map((row) => ({ profile: mapPublicUser(row.profile), friendship: mapFriendship(row.friendship) })), offset);
  }
  async profile(id: string, signal?: AbortSignal) {
    let query = this.client.rpc('get_social_profile', { p_target: id });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; checkError(error); if (!data) return null;
    const row = profileResponse.parse(data);
    return { ...mapPublicUser(row.profile), publicWorkoutCount: row.public_workout_count, achievementCount: row.achievement_count,
      achievements: row.achievements.map((a) => ({ code: a.code, title: a.title, icon: a.icon, unlockedAt: a.unlocked_at })) };
  }
  async relation(ownerId: string, targetId: string, signal?: AbortSignal) {
    // UUID validation occurs at the service boundary; no arbitrary filter interpolation.
    let query = this.client.from('friendships').select('*')
      .or(`and(requester_id.eq.${ownerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${ownerId})`);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle(); checkError(error);
    return data ? mapFriendship(friendshipResponse.parse(data)) : null;
  }
  async change(targetId: string, action: FriendAction, expectedId: string | null) {
    const { data, error } = await this.client.rpc('change_friendship', { p_target: targetId, p_action: action, p_expected_id: expectedId });
    checkError(error); return data ? mapFriendship(friendshipResponse.parse(data)) : null;
  }
}
