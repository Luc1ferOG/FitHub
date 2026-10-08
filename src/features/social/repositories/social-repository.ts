import type { Friendship } from '../types/friendship';
import type { FriendAction, FriendItem, FriendListKind, PublicProfile, PublicUser, SocialPage } from '../types/social';

export interface SocialRepository {
  search(search: string, offset: number, signal?: AbortSignal): Promise<SocialPage<PublicUser>>;
  list(kind: FriendListKind, offset: number, signal?: AbortSignal): Promise<SocialPage<FriendItem>>;
  profile(id: string, signal?: AbortSignal): Promise<PublicProfile | null>;
  relation(ownerId: string, targetId: string, signal?: AbortSignal): Promise<Friendship | null>;
  change(targetId: string, action: FriendAction, expectedId: string | null): Promise<Friendship | null>;
}
