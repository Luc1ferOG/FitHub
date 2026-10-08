import { AppError } from '@/domain/errors/app-error';
import { supabase } from '@/lib/supabase';
import type { PushDeviceRepository } from '@/services/notifications/push-device-repository';
export class SupabasePushDeviceRepository implements PushDeviceRepository {
  async register(token:string) {
    const { error } = await supabase.rpc('register_challenge_push',{ p_token:token });
    if (error) throw new AppError('Could not register notifications. Check your connection and try again.','NETWORK');
  }
  async unregister(token:string) {
    const { error } = await supabase.from('push_devices').delete().eq('token',token);
    if (error) throw new AppError('Could not unregister notifications. Reconnect before signing out.','NETWORK');
  }
}
