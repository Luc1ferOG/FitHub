import { parseDestination, type DestinationPath } from '@/services/navigation/destinations';
export type AuthRouteSegment = '(auth)' | 'reset-password' | string | undefined;
export type AuthRouteDecision =
  | { type: 'loading' }
  | { type: 'allow' }
  | { type: 'redirect'; href: '/(auth)/login' | '/(tabs)/home' | DestinationPath };

type ResolveAuthRouteOptions = {
  isInitializing: boolean;
  isAuthenticated: boolean;
  firstSegment: AuthRouteSegment;
  intendedRoute?: string | null;
};

export function resolveAuthRoute({
  isInitializing,
  isAuthenticated,
  firstSegment,
  intendedRoute,
}: ResolveAuthRouteOptions): AuthRouteDecision {
  if (isInitializing) return { type: 'loading' };
  if (firstSegment === 'reset-password') return { type: 'allow' };
  const destination = intendedRoute ? parseDestination(intendedRoute) : null;
  if (isAuthenticated && destination) return { type: 'redirect', href: destination };

  const isAuthRoute = firstSegment === '(auth)';
  if (!isAuthenticated && !isAuthRoute) {
    return { type: 'redirect', href: '/(auth)/login' };
  }
  if (isAuthenticated && isAuthRoute) {
    return { type: 'redirect', href: '/(tabs)/home' };
  }
  return { type: 'allow' };
}
