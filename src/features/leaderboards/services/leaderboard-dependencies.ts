import { SupabaseLeaderboardRepository } from '@/data/repositories/supabase/supabase-leaderboard-repository';
import { LeaderboardService } from './leaderboard-service';
export const leaderboardService = new LeaderboardService(new SupabaseLeaderboardRepository());
