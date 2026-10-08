import { SupabaseSocialRepository } from '@/data/repositories/supabase/supabase-social-repository';
import { SocialService } from './social-service';

export const socialService = new SocialService(new SupabaseSocialRepository());
