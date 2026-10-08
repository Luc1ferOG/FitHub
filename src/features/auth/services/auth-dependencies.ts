import * as Linking from 'expo-linking';

import { SupabaseAuthRepository } from '@/data/repositories/supabase/supabase-auth-repository';
import { offlineIdentityRepository } from '@/data/local/offline-identity-dependencies';
import { useAppStore } from '@/store/app-store';

import { AuthService } from './auth-service';
import { AuthSessionManager } from './auth-session-manager';

export const authRepository = new SupabaseAuthRepository();
export const authService = new AuthService(
  authRepository,
  Linking.createURL('reset-password'),
);
export const authSessionManager = new AuthSessionManager(authRepository, {
  identity: offlineIdentityRepository, isOffline: () => useAppStore.getState().isOffline,
});
