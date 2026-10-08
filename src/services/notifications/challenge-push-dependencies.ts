import { SupabasePushDeviceRepository } from '@/data/repositories/supabase/supabase-push-device-repository';
import { ChallengePushService } from './challenge-push';
export const challengePushService = new ChallengePushService(new SupabasePushDeviceRepository());
