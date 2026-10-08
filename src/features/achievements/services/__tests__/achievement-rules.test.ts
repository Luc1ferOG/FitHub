import { achievementEventTypes } from '@/domain/events/achievement-event';
import type { AchievementRepository } from '../../repositories/achievement-repository';
import type { Achievement } from '../../types/achievement';
import { achievementProgress, pendingUnlocks, progressLabel, thresholdReached } from '../achievement-rules';
import { AchievementService } from '../achievement-service';
const owner = '99000000-0000-0000-0000-000000000001'; const source = '99000000-0000-0000-0000-000000000002';
const badge: Achievement = { id: source, code: 'VOLUME_100000', title: 'Marathon Lifter', description: '', icon: 'fitness-outline',
  category: 'volume', metric: 'total_volume', current: 72500, target: 100000, unlockedAt: null, presentedAt: null, active: true };

describe('achievement thresholds and presentation', () => {
  it.each([1, 3, 5, 7, 10, 30, 50, 100, 10000, 100000, 1000000])('unlocks target %s at the threshold, not below it', (target) => {
    expect(thresholdReached(target - 1, target)).toBe(false); expect(thresholdReached(target, target)).toBe(true);
    expect(thresholdReached(target + 1, target)).toBe(true);
  });
  it.each([[NaN, 1], [Infinity, 1], [1, Infinity], [1, 0], [1, -1]])('rejects invalid current/target %j', (current, target) => {
    expect(thresholdReached(current, target)).toBe(false);
  });
  it('retains actual progress and clamps only presentation', () => {
    expect(progressLabel(badge)).toBe('72,500 / 100,000 kg'); expect(achievementProgress(badge).percent).toBe(72.5);
    expect(achievementProgress({ ...badge, current: 200000 })).toEqual({ current: 200000, displayed: 100000, percent: 100 });
    expect(achievementProgress({ ...badge, current: NaN }).percent).toBe(0);
  });
  it('presents only unacknowledged unlocked badges, ordered deterministically', () => {
    const date = '2026-10-08T10:00:00Z';
    const a = { ...badge, id: 'a', code: 'A', unlockedAt: date };
    const b = { ...badge, id: 'b', code: 'B', unlockedAt: date };
    expect(pendingUnlocks([b, badge, a, { ...badge, id: 'acknowledged', unlockedAt: date, presentedAt: date }], new Set()).map((item) => item.id)).toEqual(['a', 'b']);
    expect(pendingUnlocks([a, b], new Set(['a'])).map((item) => item.id)).toEqual(['b']);
  });
});
describe('trusted achievement domain events', () => {
  function setup() {
    const repository: jest.Mocked<AchievementRepository> = { list: jest.fn(), reconcile: jest.fn().mockResolvedValue(undefined),
      acknowledge: jest.fn(), subscribe: jest.fn() };
    return { repository, service: new AchievementService(repository) };
  }
  it.each(achievementEventTypes)('%s reconciles server facts, not a UI-supplied award', async (type) => {
    const { service, repository } = setup();
    await service.handleEvent(owner, { type, userId: owner, eventId: source, sourceId: source, occurredAt: '2026-10-08T00:00:00Z' });
    expect(repository.reconcile).toHaveBeenCalledWith(owner);
  });
  it('rejects another account or a malformed event before backend access', () => {
    const { service, repository } = setup();
    const event = { type: 'WorkoutCompleted' as const, userId: source, eventId: source, sourceId: source, occurredAt: '2026-10-08T00:00:00Z' };
    expect(() => service.handleEvent(owner, event)).toThrow();
    expect(() => service.handleEvent(owner, { ...event, userId: owner, occurredAt: 'invalid' })).toThrow();
    expect(repository.reconcile).not.toHaveBeenCalled();
  });
});
