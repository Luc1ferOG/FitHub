import { isUuid } from '@/validation/uuid';

export type DestinationPath = `/challenges/${string}` | `/workouts/${string}` | `/workouts/active/${string}` | `/user/${string}` | '/friends/requests' | '/achievements' | '/link-unavailable';
const safeSegment = /^[A-Za-z0-9-]{1,128}$/;

/** Structural allowlist. UUID validity is checked before feature queries, so a
 * safe but invalid identifier can survive login and show its unavailable state. */
export function parseDestination(input: string): DestinationPath | null {
  if (input.length > 1024 || input.includes('\\') || input.includes('..') || /[\u0000-\u0020]/.test(input)) return null;
  let path = input;
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
    try {
      const url = new URL(input);
      if (url.protocol !== 'fithub:' || url.username || url.password || url.port || url.search || url.hash) return null;
      path = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
    } catch { return null; }
  }
  if (path.includes('?') || path.includes('#') || path.includes('%') || path.includes('..')) return null;
  path = path.replace(/\/$/, '');
  if (path === '/friends/requests' || path === '/achievements' || path === '/link-unavailable') return path;
  const match = /^\/(challenge|challenges|workout|workouts|user)\/([^/]+)$/.exec(path);
  if (match && safeSegment.test(match[2] ?? '')) {
    const root = match[1] === 'challenge' ? 'challenges' : match[1] === 'workout' ? 'workouts' : match[1];
    return `/${root}/${match[2]}` as DestinationPath;
  }
  const session = /^\/workouts\/active\/([^/]+)$/.exec(path);
  return session && isUuid(session[1] ?? '') ? `/workouts/active/${session[1]}` : null;
}

export type NotificationTarget = { path: DestinationPath; recipientId: string };
export function notificationTarget(data: unknown): NotificationTarget | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const payload = data as Record<string, unknown>;
  if (typeof payload['userId'] !== 'string' || !isUuid(payload['userId'])) return null;
  const kind = payload['kind'];
  if (typeof kind !== 'string') return null;
  let path: DestinationPath | null = null;
  if (kind === 'friend_request') path = '/friends/requests';
  else if (kind === 'achievement_unlocked') path = '/achievements';
  else if (kind === 'workout-rest' || kind === 'rest_timer_completed') {
    if (typeof payload['sessionId'] === 'string' && isUuid(payload['sessionId'])) path = `/workouts/active/${payload['sessionId']}`;
  } else if (['invite', 'ending_soon', 'ending', 'ended', 'challenge_invite', 'challenge_ending_soon', 'joined', 'friend_joined', 'passed', 'rank_passed', 'completed', 'winner'].includes(kind)) {
    if (typeof payload['challengeId'] === 'string' && isUuid(payload['challengeId'])) path = `/challenges/${payload['challengeId']}`;
  }
  return path ? { path, recipientId: payload['userId'] } : null;
}
