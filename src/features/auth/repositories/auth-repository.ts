import type {
  AuthSession,
  LoginCredentials,
  RegistrationDetails,
  RegistrationResult,
} from '../types/auth';

export type AuthSessionListener = (session: AuthSession | null, event?: string) => void;

export interface AuthRepository {
  getSession(): Promise<AuthSession | null>;
  onSessionChange(listener: AuthSessionListener): () => void;
  register(details: RegistrationDetails): Promise<RegistrationResult>;
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  requestPasswordReset(email: string, redirectUrl: string): Promise<void>;
  exchangePasswordRecoveryCode(code: string): Promise<AuthSession>;
  updatePassword(password: string): Promise<void>;
  isUsernameAvailable(username: string): Promise<boolean>;
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
}
