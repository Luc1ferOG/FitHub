import { SupabaseAchievementRepository } from '@/data/repositories/supabase/supabase-achievement-repository';
import { AchievementService } from './achievement-service';

export const achievementService = new AchievementService(new SupabaseAchievementRepository());
