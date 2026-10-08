import { AppError } from '@/domain/errors/app-error';
import type { SocialRepository } from '../repositories/social-repository';
import type { Friendship } from '../types/friendship';
import type { FriendAction, FriendListKind } from '../types/social';
import { canChangeFriend, friendState } from './friend-state';

export function requireSocialId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError('Invalid user identifier.', 'VALIDATION');
}
export function normalizeSearch(search: string): string { return search.trim().replace(/\s+/g, ' '); }
function requireOffset(offset: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new AppError('Invalid page.', 'VALIDATION');
}
export class SocialService {
  constructor(private readonly repository: SocialRepository) {}
  search(search: string, offset: number, signal?: AbortSignal) {
    const normalized = normalizeSearch(search); requireOffset(offset);
    if (normalized.length < 2 || normalized.length > 80) throw new AppError('Enter 2–80 characters to search.', 'VALIDATION');
    return this.repository.search(normalized, offset, signal);
  }
  list(kind: FriendListKind, offset: number, signal?: AbortSignal) {
    requireOffset(offset); return this.repository.list(kind, offset, signal);
  }
  async profile(id: string, signal?: AbortSignal) {
    requireSocialId(id); const profile = await this.repository.profile(id, signal);
    if (!profile) throw new AppError('This profile is unavailable.', 'NOT_FOUND'); return profile;
  }
  relation(owner: string, target: string, signal?: AbortSignal) {
    requireSocialId(owner); requireSocialId(target);
    return owner === target ? Promise.resolve(null) : this.repository.relation(owner, target, signal);
  }
  change(owner: string, target: string, action: FriendAction, relation: Friendship | null) {
    requireSocialId(owner); requireSocialId(target);
    if (relation && !((relation.requesterId === owner && relation.addresseeId === target) || (relation.requesterId === target && relation.addresseeId === owner))) {
      throw new AppError('Refresh this user’s friend status before trying again.', 'CONFLICT');
    }
    if (!canChangeFriend(friendState(owner, target, relation), action)) throw new AppError('This friend action is no longer available. Refresh and try again.', 'CONFLICT');
    return this.repository.change(target, action, relation?.id ?? null);
  }
}
