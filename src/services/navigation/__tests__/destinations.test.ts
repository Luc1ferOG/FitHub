import { parseDestination, notificationTarget } from '../destinations';
import { intendedDestination } from '../navigation-intent';
import { resolveAuthRoute } from '@/features/auth/services/auth-route-guard';

const id = '10000000-0000-0000-0000-000000000001';
describe('validated navigation destinations', () => {
  it.each(['challenge', 'workout', 'user'])('normalizes a %s deep link', (kind) => {
    const root = kind === 'challenge' ? 'challenges' : kind === 'workout' ? 'workouts' : kind;
    expect(parseDestination(`fithub://${kind}/${id}`)).toBe(`/${root}/${id}`);
  });
  it('preserves a safe invalid ID through login for a graceful invalid-link screen', () => {
    const path = parseDestination('fithub://challenge/abc');
    expect(resolveAuthRoute({ isInitializing: false, isAuthenticated: false, firstSegment: 'challenges', intendedRoute: path })).toEqual({ type: 'redirect', href: '/(auth)/login' });
    expect(resolveAuthRoute({ isInitializing: false, isAuthenticated: true, firstSegment: '(auth)', intendedRoute: path })).toEqual({ type: 'redirect', href: '/challenges/abc' });
  });
  it('rejects external URL injection and wrong-account notification routing', () => {
    expect(parseDestination('https://evil.example')).toBeNull();
    expect(notificationTarget({ kind: 'invite', userId: id, challengeId: 'abc' })).toBeNull();
    expect(intendedDestination({ path: '/achievements', recipientId: id, createdAt: 1 }, 'other', 2)).toBeNull();
  });
});
