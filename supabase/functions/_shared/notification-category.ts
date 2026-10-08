export function notificationCategory(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('kind' in data)) return undefined;
  if (data.kind === 'friend_request' || data.kind === 'achievement_unlocked') return data.kind;
  if (data.kind === 'invite' || data.kind === 'challenge_invite') return 'challenge_invite';
  if (data.kind === 'ending_soon' || data.kind === 'challenge_ending_soon') return 'challenge_ending_soon';
  return undefined;
}
