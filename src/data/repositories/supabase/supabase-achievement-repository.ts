import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import { achievementEventTypes, type AchievementDomainEvent } from '@/domain/events/achievement-event';
import type { AchievementRepository } from '@/features/achievements/repositories/achievement-repository';
import { achievementResponse } from '@/features/achievements/validation/achievement-response';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

function check(error: { message: string; code?: string } | null) {
  if (error) throw new AppError('Could not load or save achievements. Check your connection and try again.', error.code === '42501' ? 'AUTHORIZATION' : 'NETWORK', { cause: error });
}
export class SupabaseAchievementRepository implements AchievementRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async list(owner: string, signal?: AbortSignal) {
    let query = this.client.rpc('get_my_achievements', { p_user: owner });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; check(error);
    return achievementResponse.parse(data);
  }
  async reconcile(owner: string) {
    const { error } = await this.client.rpc('reconcile_achievements', { p_user: owner }); check(error);
  }
  async acknowledge(owner: string, id: string) {
    const { error } = await this.client.rpc('acknowledge_achievement', { p_user: owner, p_id: id }); check(error);
  }
  subscribe(owner: string, onEvent: (event: AchievementDomainEvent) => void, onAwards: () => void, onReconnect: () => void) {
    let active = true;
    const channel = this.client.channel('achievement-events:' + owner)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'achievement_events', filter: 'user_id=eq.' + owner }, ({ new: row }) => {
        if (!active || row['user_id'] !== owner || typeof row['event_type'] !== 'string') return;
        const type = achievementEventTypes.find((value) => value === row['event_type']);
        if (type && typeof row['id'] === 'string' && typeof row['source_id'] === 'string' && typeof row['occurred_at'] === 'string') {
          onEvent({ type, userId: owner, eventId: row['id'], sourceId: row['source_id'], occurredAt: row['occurred_at'] });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_achievements', filter: 'user_id=eq.' + owner }, () => { if (active) onAwards(); })
      .subscribe((status) => { if (active && status === 'SUBSCRIBED') onReconnect(); });
    return () => { active = false; void this.client.removeChannel(channel).catch(() => undefined); };
  }
}
