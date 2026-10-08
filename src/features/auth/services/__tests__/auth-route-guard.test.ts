import { resolveAuthRoute } from '../auth-route-guard';

describe('resolveAuthRoute', () => {
  it('waits while the persisted session is being restored', () => {
    expect(
      resolveAuthRoute({ isInitializing: true, isAuthenticated: false, firstSegment: '(tabs)' }),
    ).toEqual({ type: 'loading' });
  });

  it('redirects unauthenticated users away from protected routes', () => {
    expect(
      resolveAuthRoute({ isInitializing: false, isAuthenticated: false, firstSegment: '(tabs)' }),
    ).toEqual({ type: 'redirect', href: '/(auth)/login' });
  });

  it('redirects authenticated users away from auth routes', () => {
    expect(
      resolveAuthRoute({ isInitializing: false, isAuthenticated: true, firstSegment: '(auth)' }),
    ).toEqual({ type: 'redirect', href: '/(tabs)/home' });
  });

  it('allows the password recovery callback before and after authentication', () => {
    expect(
      resolveAuthRoute({
        isInitializing: false,
        isAuthenticated: false,
        firstSegment: 'reset-password',
      }),
    ).toEqual({ type: 'allow' });
  });
});
