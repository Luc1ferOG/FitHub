import type { Friendship } from '../types/friendship';
import type { FriendAction, FriendState } from '../types/social';

export function friendState(owner: string, target: string, relation: Friendship | null): FriendState {
  if (owner === target) return 'self';
  if (!relation || relation.status === 'declined') return 'none';
  if (relation.status === 'accepted') return 'friends';
  return relation.requesterId === owner ? 'outgoing' : 'incoming';
}
export function canChangeFriend(state: FriendState, action: FriendAction): boolean {
  return (state === 'none' && action === 'send') || (state === 'incoming' && (action === 'accept' || action === 'reject'))
    || (state === 'outgoing' && action === 'cancel') || (state === 'friends' && action === 'remove');
}
export function optimisticRelation(relation: Friendship | null, action: FriendAction): Friendship | null {
  // Do not invent server IDs for send; the request button still shows a pending state.
  if (!relation) return null;
  if (action === 'accept') return { ...relation, status: 'accepted' };
  if (action === 'reject') return { ...relation, status: 'declined' };
  if (action === 'cancel' || action === 'remove') return null;
  return relation;
}
export const socialKeys = {
  root: (owner: string) => ['social', owner] as const,
  relation: (owner: string, target: string) => ['social', owner, 'relation', target] as const,
  profile: (owner: string, target: string) => ['social', owner, 'profile', target] as const,
  search: (owner: string, search: string) => ['social', owner, 'search', search] as const,
  list: (owner: string, kind: string) => ['social', owner, 'list', kind] as const,
  write: (owner: string, target: string) => ['social-write', owner, target] as const,
};
