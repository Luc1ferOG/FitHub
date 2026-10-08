import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import type { DashboardRepository } from '@/features/home/repositories/dashboard-repository';
import { dashboardResponse } from '@/features/home/validation/dashboard-response';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
export class SupabaseDashboardRepository implements DashboardRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async load(timezone: string, signal?: AbortSignal) {
    let query = this.client.rpc('get_home_dashboard', { p_timezone: timezone });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new AppError('Could not refresh your dashboard. Check your connection and try again.', error.code === '42501' ? 'AUTHORIZATION' : 'NETWORK', { cause: error });
    return dashboardResponse.parse(data);
  }
}
