import { AppError } from '@/domain/errors/app-error';

import type { AuthRepository } from '../repositories/auth-repository';
import type { AuthSession, RegistrationResult } from '../types/auth';
import {
  loginSchema,
  newPasswordSchema,
  passwordResetRequestSchema,
  registerSchema,
  type LoginFormValues,
  type NewPasswordFormValues,
  type PasswordResetRequestValues,
  type RegisterFormValues,
} from '../validation/auth-schema';

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwordResetRedirectUrl: string,
  ) {}

  getSession(): Promise<AuthSession | null> {
    return this.repository.getSession();
  }

  onSessionChange(listener: (session: AuthSession | null) => void): () => void {
    return this.repository.onSessionChange(listener);
  }

  async register(values: RegisterFormValues): Promise<RegistrationResult> {
    const details = registerSchema.parse(values);
    const username = details.username.toLowerCase();

    if (!(await this.repository.isUsernameAvailable(username))) {
      throw new AppError('That username is already taken.', 'CONFLICT');
    }

    return this.repository.register({
      username,
      displayName: details.displayName,
      email: details.email,
      password: details.password,
    });
  }

  async login(values: LoginFormValues): Promise<AuthSession> {
    return this.repository.login(loginSchema.parse(values));
  }

  logout(): Promise<void> {
    return this.repository.logout();
  }

  async requestPasswordReset(values: PasswordResetRequestValues): Promise<void> {
    const { email } = passwordResetRequestSchema.parse(values);
    await this.repository.requestPasswordReset(email, this.passwordResetRedirectUrl);
  }

  async exchangePasswordRecoveryCode(code: string): Promise<AuthSession> {
    if (!code.trim()) {
      throw new AppError('The password reset link is invalid.', 'VALIDATION');
    }
    return this.repository.exchangePasswordRecoveryCode(code);
  }

  async updatePassword(values: NewPasswordFormValues): Promise<void> {
    const { password } = newPasswordSchema.parse(values);
    await this.repository.updatePassword(password);
  }

  startAutoRefresh(): void {
    this.repository.startAutoRefresh();
  }

  stopAutoRefresh(): void {
    this.repository.stopAutoRefresh();
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.code) {
      case 'AUTHENTICATION':
        return error.message.startsWith('Confirm')
          ? error.message
          : 'The email or password is incorrect.';
      case 'CONFLICT':
        return error.message;
      case 'NETWORK':
        return 'Unable to reach FitHub. Check your connection and try again.';
      case 'VALIDATION':
        return error.message;
      default:
        return 'Authentication could not be completed. Please try again.';
    }
  }

  return 'Authentication could not be completed. Please try again.';
}
