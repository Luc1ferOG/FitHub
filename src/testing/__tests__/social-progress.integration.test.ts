import { AppError } from '@/domain/errors/app-error';
import { SocialService } from '@/features/social/services/social-service';
import { friendState } from '@/features/social/services/friend-state';
import type { SocialRepository } from '@/features/social/repositories/social-repository';
import type { Friendship } from '@/features/social/types/friendship';
import { ChallengeService } from '@/features/challenges/services/challenge-service';
import type { ChallengeRepository } from '@/features/challenges/repositories/challenge-repository';
import { MeasurementService } from '@/features/progress/services/measurement-service';
import { emptyMeasurementForm, parseMeasurementForm } from '@/features/progress/services/measurement-rules';
import type { MeasurementRepository } from '@/features/progress/repositories/measurement-repository';

const alex = '99000000-0000-0000-0000-000000000001';
const sam = '99000000-0000-0000-0000-000000000002';
const id = '79000000-0000-0000-0000-000000000001';
describe('social and progress workflows through service boundaries', () => {
  it('sends, accepts and removes a friendship; blocks self, duplicate and sender acceptance', async () => {
    const pending: Friendship = { id, requesterId: alex, addresseeId: sam, status: 'pending', createdAt: '2026-10-08T12:00:00Z' };
    const accepted: Friendship = { ...pending, status: 'accepted' };
    const repository: jest.Mocked<SocialRepository> = { search: jest.fn(), list: jest.fn(), profile: jest.fn(), relation: jest.fn(), change: jest.fn() };
    repository.change.mockResolvedValueOnce(pending).mockResolvedValueOnce(accepted).mockResolvedValueOnce(null);
    const service = new SocialService(repository);
    expect(() => service.change(alex, alex, 'send', null)).toThrow(AppError);
    const request = await service.change(alex, sam, 'send', null);
    expect(friendState(alex, sam, request)).toBe('outgoing');
    expect(friendState(sam, alex, request)).toBe('incoming');
    expect(() => service.change(alex, sam, 'send', request)).toThrow(AppError);
    expect(() => service.change(alex, sam, 'accept', request)).toThrow(AppError);
    const friendship = await service.change(sam, alex, 'accept', request);
    expect(friendState(alex, sam, friendship)).toBe('friends');
    expect(await service.change(alex, sam, 'remove', friendship)).toBeNull();
    expect(repository.change.mock.calls).toEqual([[sam, 'send', null], [alex, 'accept', id], [sam, 'remove', id]]);
  });

  it('creates a minutes challenge using canonical seconds, joins, leaves and accepts an invitation', async () => {
    const repository: jest.Mocked<ChallengeRepository> = { list: jest.fn(), detail: jest.fn(), create: jest.fn(), manage: jest.fn(), subscribe: jest.fn() };
    repository.create.mockResolvedValue(id); repository.manage.mockResolvedValue(undefined);
    const service = new ChallengeService(repository, () => new Date('2026-10-08T12:00:00Z'));
    expect(await service.create({ title: 'Thirty minutes', description: '', metric: 'duration_seconds', target: 30,
      startDate: '2026-10-08', endDate: '2026-10-31', visibility: 'public', exerciseId: null })).toBe(id);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ target: 1800 }));
    await service.manage(id, 'join'); await service.manage(id, 'leave'); await service.manage(id, 'accept');
    expect(repository.manage.mock.calls).toEqual([[id, 'join', null], [id, 'leave', null], [id, 'accept', null]]);
    // Membership authority/idempotency stays on the server, not a guessed client-side membership flag.
    repository.manage.mockRejectedValueOnce(new AppError('Invitation unavailable.', 'AUTHORIZATION'));
    await expect(service.manage(id, 'accept')).rejects.toMatchObject({ code: 'AUTHORIZATION' });
    expect(() => service.manage('not-a-uuid', 'join')).toThrow(AppError);
  });

  it('converts imperial entry to canonical values, creates, edits and removes the owned measurement', async () => {
    const repository: jest.Mocked<MeasurementRepository> = { list: jest.fn(), get: jest.fn(), dashboard: jest.fn(), preferredUnits: jest.fn(), save: jest.fn(), remove: jest.fn() };
    const values = { ...emptyMeasurementForm(new Date('2020-01-01T12:00:00Z')), weightKg: '176.37', waistCm: '32', bodyFatPercentage: '20' };
    const input = parseMeasurementForm(values, 'imperial', new Date('2026-10-08T12:00:00Z'));
    repository.save.mockImplementation(async (owner, data) => ({ ...data, id, userId: owner }));
    repository.remove.mockResolvedValue(undefined);
    const service = new MeasurementService(repository);
    const measurement = await service.save(alex, input);
    expect(measurement).toMatchObject({ userId: alex, weightKg: 80, waistCm: 81.28, bodyFatPercentage: 20 });
    await service.save(alex, { ...input, weightKg: 79.5 }, measurement.id);
    expect(repository.save).toHaveBeenLastCalledWith(alex, expect.objectContaining({ weightKg: 79.5 }), id);
    expect(() => service.save(alex, { ...input, weightKg: -1 })).toThrow(AppError);
    expect(repository.save).toHaveBeenCalledTimes(2);
    await service.remove(alex, id); expect(repository.remove).toHaveBeenCalledWith(alex, id);
  });
});
