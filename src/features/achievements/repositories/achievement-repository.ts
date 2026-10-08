import type { AchievementDomainEvent } from '@/domain/events/achievement-event';
import type { AchievementBoard } from '../types/achievement';
export interface AchievementRepository {
  list(owner: string, signal?: AbortSignal): Promise<AchievementBoard>;
  reconcile(owner: string): Promise<void>;
  acknowledge(owner: string, id: string): Promise<void>;
  subscribe(owner: string, onEvent: (event: AchievementDomainEvent) => void, onAwardsChanged: () => void, onReconnect: () => void): () => void;
}
