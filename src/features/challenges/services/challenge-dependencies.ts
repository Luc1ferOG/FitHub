import { SupabaseChallengeRepository } from '@/data/repositories/supabase/supabase-challenge-repository';
import { ChallengeService } from './challenge-service';
export const challengeService = new ChallengeService(new SupabaseChallengeRepository());
