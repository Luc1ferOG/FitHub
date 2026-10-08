import { parseDestination } from '@/services/navigation/destinations';
import { useNavigationIntentStore } from '@/store/navigation-intent-store';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  // Preserve PKCE recovery query parameters; they are never stored as an intent.
  try {
    if (/^fithub:/i.test(path)) {
      const url = new URL(path);
      const route = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
      if (route === '/reset-password' && !url.username && !url.password && !url.port) return `/reset-password${url.search}`;
      const destination = parseDestination(path) ?? '/link-unavailable';
      useNavigationIntentStore.getState().capture(destination);
      return destination;
    }
    return path.startsWith('/') ? parseDestination(path) ?? path : path;
  } catch { return '/link-unavailable'; }
}
