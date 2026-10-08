import { AppError } from '@/domain/errors/app-error';
import { achievementEventTypes, type AchievementDomainEvent } from '@/domain/events/achievement-event';
import { requireUuid } from '@/validation/uuid';
import type { AchievementRepository } from '../repositories/achievement-repository';
export class AchievementService {
  constructor(private readonly repository: AchievementRepository) {}
  list(owner: string, signal?: AbortSignal) { requireUuid(owner); return this.repository.list(owner, signal); }
  reconcile(owner: string) { requireUuid(owner); return this.repository.reconcile(owner); }
  handleEvent(owner: string, event: AchievementDomainEvent) {
    requireUuid(owner); requireUuid(event.eventId); requireUuid(event.sourceId);
    if (event.userId !== owner) throw new AppError('This event belongs to another account.', 'AUTHORIZATION');
    if (!achievementEventTypes.includes(event.type) || !Number.isFinite(Date.parse(event.occurredAt))) throw new AppError('Invalid achievement event.', 'VALIDATION');
    // Event payloads never authorize an unlock: reconcile trusted database facts instead.
    return this.repository.reconcile(owner);
  }
  acknowledge(owner: string, id: string) { requireUuid(owner); requireUuid(id); return this.repository.acknowledge(owner, id); }
  subscribe(owner: string, event: (event: AchievementDomainEvent) => void, awards: () => void, reconnect: () => void) {
    requireUuid(owner); return this.repository.subscribe(owner, event, awards, reconnect);
  }
}
