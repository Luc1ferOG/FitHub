import type { AuthRepository, AuthSessionListener } from '../../repositories/auth-repository';
import type { AuthSession } from '../../types/auth';
import { AuthSessionManager, type AuthSessionState } from '../auth-session-manager';

const session: AuthSession = {
  user: { id: 'user-1', email: 'user@example.com' },
  expiresAt: 2_000_000_000,
};

function createRepository(
  getSession: () => Promise<AuthSession | null>,
  onSessionChange: (listener: AuthSessionListener) => () => void,
): AuthRepository {
  return {
    getSession,
    onSessionChange,
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    requestPasswordReset: jest.fn(),
    exchangePasswordRecoveryCode: jest.fn(),
    updatePassword: jest.fn(),
    isUsernameAvailable: jest.fn(),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
}

describe('AuthSessionManager', () => {
  it('restores a persisted session', async () => {
    const listener = jest.fn<void, [AuthSessionState]>();
    const repository = createRepository(
      () => Promise.resolve(session),
      () => jest.fn(),
    );

    const stop = new AuthSessionManager(repository).start(listener);
    await Promise.resolve();

    expect(listener).toHaveBeenCalledWith({
      session,
      isInitializing: false,
      restorationError: null,
    });
    stop();
  });

  it('does not let a stale restoration overwrite a newer auth event', async () => {
    let resolveRestoration: (value: AuthSession | null) => void = () => undefined;
    const restoration = new Promise<AuthSession | null>((resolve) => {
      resolveRestoration = resolve;
    });
    let emit: AuthSessionListener = () => undefined;
    const listener = jest.fn<void, [AuthSessionState]>();
    const repository = createRepository(
      () => restoration,
      (sessionListener) => {
        emit = sessionListener;
        return jest.fn();
      },
    );

    new AuthSessionManager(repository).start(listener);
    emit(session);
    resolveRestoration(null);
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({
      session,
      isInitializing: false,
      restorationError: null,
    });
  });
});
