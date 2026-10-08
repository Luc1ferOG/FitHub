import type { AuthRepository } from '../../repositories/auth-repository';
import type { RegisterFormValues } from '../../validation/auth-schema';
import { AuthService } from '../auth-service';

function createRepository(): jest.Mocked<AuthRepository> {
  return {
    getSession: jest.fn(),
    onSessionChange: jest.fn(),
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

const registration: RegisterFormValues = {
  username: 'fit_user',
  displayName: 'Fit User',
  email: 'fit@example.com',
  password: 'password123',
  confirmPassword: 'password123',
};

describe('AuthService registration', () => {
  it('checks username availability before registering', async () => {
    const repository = createRepository();
    repository.isUsernameAvailable.mockResolvedValue(true);
    repository.register.mockResolvedValue({
      user: { id: 'user-1', email: registration.email },
      session: null,
    });
    const service = new AuthService(repository, 'fithub://reset-password');

    await service.register(registration);

    expect(repository.isUsernameAvailable).toHaveBeenCalledWith('fit_user');
    expect(repository.register).toHaveBeenCalledWith({
      username: registration.username,
      displayName: registration.displayName,
      email: registration.email,
      password: registration.password,
    });
  });

  it('rejects a username collision without attempting signup', async () => {
    const repository = createRepository();
    repository.isUsernameAvailable.mockResolvedValue(false);
    const service = new AuthService(repository, 'fithub://reset-password');

    await expect(service.register(registration)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(repository.register).not.toHaveBeenCalled();
  });
});
