import { useMutation } from '@tanstack/react-query';

import { authService } from '../services/auth-dependencies';
import { challengePushService } from '@/services/notifications/challenge-push-dependencies';
import { logoutWithCleanup } from '../services/logout-with-cleanup';

const authMutationOptions = { retry: false, meta: { persist: false } } as const;

export function useLoginMutation() {
  return useMutation({ ...authMutationOptions, mutationFn: authService.login.bind(authService) });
}

export function useRegisterMutation() {
  return useMutation({ ...authMutationOptions, mutationFn: authService.register.bind(authService) });
}

export function useLogoutMutation() {
  return useMutation({ ...authMutationOptions, mutationFn: () => logoutWithCleanup(authService, challengePushService) });
}

export function usePasswordResetRequestMutation() {
  return useMutation({ ...authMutationOptions, mutationFn: authService.requestPasswordReset.bind(authService) });
}

export function usePasswordRecoveryCodeMutation() {
  return useMutation({ ...authMutationOptions, mutationFn: authService.exchangePasswordRecoveryCode.bind(authService) });
}

export function useUpdatePasswordMutation() {
  return useMutation({ ...authMutationOptions, mutationFn: authService.updatePassword.bind(authService) });
}
