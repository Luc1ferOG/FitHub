import type { Session, User } from '@supabase/supabase-js';

import { AppError } from '@/domain/errors/app-error';
import type {
  AuthRepository,
  AuthSessionListener,
} from '@/features/auth/repositories/auth-repository';
import type {
  AuthSession,
  LoginCredentials,
  RegistrationDetails,
  RegistrationResult,
} from '@/features/auth/types/auth';
import { supabase } from '@/lib/supabase';

function mapUser(user: User) {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

function mapSession(session: Session): AuthSession {
  return {
    user: mapUser(session.user),
    expiresAt: session.expires_at ?? null,
  };
}

function toAuthError(error: unknown): AppError {
  let message = 'Unknown authentication error';
  if (error instanceof Error) {
    message = error.message;
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    message = error.message;
  }
  const normalizedMessage = message.toLowerCase();

  if (
    error instanceof TypeError ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch')
  ) {
    return new AppError('Authentication network request failed.', 'NETWORK', { cause: error });
  }

  if (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('invalid credentials')
  ) {
    return new AppError('Invalid login credentials.', 'AUTHENTICATION', { cause: error });
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return new AppError('Confirm your email before logging in.', 'AUTHENTICATION', {
      cause: error,
    });
  }

  if (
    normalizedMessage.includes('expired') ||
    normalizedMessage.includes('code verifier') ||
    normalizedMessage.includes('invalid flow state') ||
    normalizedMessage.includes('invalid grant')
  ) {
    return new AppError('This recovery link is invalid or has expired.', 'VALIDATION', {
      cause: error,
    });
  }

  if (
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('duplicate key')
  ) {
    return new AppError('An account with these details already exists.', 'CONFLICT', { cause: error });
  }

  return new AppError('Authentication request failed.', 'UNKNOWN', { cause: error });
}

function requireSession(session: Session | null): AuthSession {
  if (!session) {
    throw new AppError('Authentication did not return a session.', 'AUTHENTICATION');
  }
  return mapSession(session);
}

export class SupabaseAuthRepository implements AuthRepository {
  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw toAuthError(error);
    return data.session ? mapSession(data.session) : null;
  }

  onSessionChange(listener: AuthSessionListener): () => void {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      listener(session ? mapSession(session) : null, event);
    });
    return () => data.subscription.unsubscribe();
  }

  async register(details: RegistrationDetails): Promise<RegistrationResult> {
    const { data, error } = await supabase.auth.signUp({
      email: details.email,
      password: details.password,
      options: {
        data: {
          username: details.username,
          display_name: details.displayName,
        },
      },
    });

    if (error) throw toAuthError(error);
    if (!data.user) {
      throw new AppError('Registration did not create a user.', 'UNKNOWN');
    }

    return {
      user: mapUser(data.user),
      session: data.session ? mapSession(data.session) : null,
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw toAuthError(error);
    return requireSession(data.session);
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw toAuthError(error);
  }

  async requestPasswordReset(email: string, redirectUrl: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw toAuthError(error);
  }

  async exchangePasswordRecoveryCode(code: string): Promise<AuthSession> {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw toAuthError(error);
    return requireSession(data.session);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw toAuthError(error);
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (error) throw toAuthError(error);
    return data === null;
  }

  startAutoRefresh(): void {
    supabase.auth.startAutoRefresh();
  }

  stopAutoRefresh(): void {
    supabase.auth.stopAutoRefresh();
  }
}
