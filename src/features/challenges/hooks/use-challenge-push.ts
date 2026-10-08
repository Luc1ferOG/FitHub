import { useMutation } from '@tanstack/react-query';
import { challengePushService } from '@/services/notifications/challenge-push-dependencies';
export function useChallengePush() {
  return useMutation({ retry:false,mutationFn:(enabled:boolean) => enabled ? challengePushService.enable() : challengePushService.disable() });
}
