import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { AppError } from '@/domain/errors/app-error';
import { AppThemeProvider } from '@/theme';
import { authService } from '../../services/auth-dependencies';
import type { AuthSession } from '../../types/auth';
import { LoginScreen } from '../login-screen';
import { RegisterScreen } from '../register-screen';

jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), Link: ({ children }: PropsWithChildren) => children }));
jest.mock('../../services/auth-dependencies', () => ({ authService: { login: jest.fn(), register: jest.fn() } }));
jest.mock('@/services/notifications/challenge-push-dependencies', () => ({ challengePushService: { disable: jest.fn() } }));
const session: AuthSession = { user: { id: '99000000-0000-0000-0000-000000000001', email: 'alex@example.test' }, expiresAt: null };
function setup(component: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  const view = render(<QueryClientProvider client={client}><AppThemeProvider>{component}</AppThemeProvider></QueryClientProvider>);
  return () => { view.unmount(); client.clear(); };
}
function enterLogin() {
  fireEvent.changeText(screen.getByLabelText('Email'), ' Alex@Example.test ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'SecurePass42!');
}
function enterRegistration() {
  enterLogin();
  fireEvent.changeText(screen.getByLabelText('Username'), 'fit_alex');
  fireEvent.changeText(screen.getByLabelText('Display name'), 'Alex Example');
  fireEvent.changeText(screen.getByLabelText('Confirm password'), 'SecurePass42!');
}
beforeEach(() => {
  jest.mocked(authService.login).mockReset().mockResolvedValue(session);
  jest.mocked(authService.register).mockReset().mockResolvedValue({ user: session.user, session: null });
});

describe('login form', () => {
  it('validates before communicating with the service', async () => {
    const cleanup = setup(<LoginScreen />);
    try {
      fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
      fireEvent.changeText(screen.getByLabelText('Password'), 'short');
      fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
      expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
      expect(screen.getByText('Password must contain at least 8 characters')).toBeTruthy();
      expect(authService.login).not.toHaveBeenCalled();
    } finally { cleanup(); }
  });
  it('submits normalized credentials and toggles password visibility', async () => {
    const cleanup = setup(<LoginScreen />);
    try {
      enterLogin(); expect(screen.getByLabelText('Password').props['secureTextEntry']).toBe(true);
      fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
      expect(screen.getByLabelText('Password').props['secureTextEntry']).toBe(false);
      fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
      fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() => expect(jest.mocked(authService.login).mock.calls[0]?.[0]).toEqual({ email: 'alex@example.test', password: 'SecurePass42!' }));
    } finally { cleanup(); }
  });
  it.each([
    [new AppError('Invalid login credentials.', 'AUTHENTICATION'), 'The email or password is incorrect.'],
    [new AppError('Private transport detail', 'NETWORK'), 'Unable to reach FitHub. Check your connection and try again.'],
  ] as const)('shows an actionable error without exposing transport details', async (error, message) => {
    jest.mocked(authService.login).mockRejectedValue(error);
    const cleanup = setup(<LoginScreen />);
    try {
      enterLogin(); fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
      expect(await screen.findByText(message)).toBeTruthy(); expect(screen.queryByText('Private transport detail')).toBeNull();
    } finally { cleanup(); }
  });
  it('disables repeat submission while the request is in flight', async () => {
    let finish: ((value: AuthSession) => void) | undefined;
    jest.mocked(authService.login).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const cleanup = setup(<LoginScreen />);
    try {
      enterLogin(); fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled());
      fireEvent.press(screen.getByRole('button', { name: 'Log in' })); expect(authService.login).toHaveBeenCalledTimes(1);
      await act(async () => { finish?.(session); });
    } finally { cleanup(); }
  });
});
describe('registration form', () => {
  it('distinguishes both password visibility controls for screen readers', () => {
    const cleanup = setup(<RegisterScreen />);
    try {
      fireEvent.press(screen.getByRole('button', { name: 'Show confirm password' }));
      expect(screen.getByLabelText('Confirm password').props['secureTextEntry']).toBe(false);
      expect(screen.getByLabelText('Password').props['secureTextEntry']).toBe(true);
    } finally { cleanup(); }
  });
  it('requires valid username and matching confirmation', async () => {
    const cleanup = setup(<RegisterScreen />);
    try {
      enterRegistration(); fireEvent.changeText(screen.getByLabelText('Username'), 'bad name');
      fireEvent.changeText(screen.getByLabelText('Confirm password'), 'DifferentPass!');
      fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByText('Passwords do not match')).toBeTruthy();
      expect(screen.getByText('Use only lowercase letters, numbers, and underscores')).toBeTruthy();
      expect(authService.register).not.toHaveBeenCalled();
    } finally { cleanup(); }
  });
  it('submits valid fields and explains email confirmation without pretending to be logged in', async () => {
    const cleanup = setup(<RegisterScreen />);
    try {
      enterRegistration(); fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByText('Account created. Check your email to confirm your address, then log in.')).toBeTruthy();
      expect(jest.mocked(authService.register).mock.calls[0]?.[0]).toEqual({ username: 'fit_alex', displayName: 'Alex Example', email: 'alex@example.test',
        password: 'SecurePass42!', confirmPassword: 'SecurePass42!' });
    } finally { cleanup(); }
  });
  it('keeps entered fields after a duplicate username error', async () => {
    jest.mocked(authService.register).mockRejectedValue(new AppError('That username is already taken.', 'CONFLICT'));
    const cleanup = setup(<RegisterScreen />);
    try {
      enterRegistration(); fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByText('That username is already taken.')).toBeTruthy();
      expect(screen.getByLabelText('Username').props['value']).toBe('fit_alex');
      expect(screen.getByLabelText('Email').props['value']).toBe(' Alex@Example.test ');
    } finally { cleanup(); }
  });
});
