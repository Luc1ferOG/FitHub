import { AppError } from '@/domain/errors/app-error';
import type { MeasurementRepository } from '../repositories/measurement-repository';
import { measurementFields, type MeasurementInput, type ProgressPeriod } from '../types/measurement';
import { validMeasurementDate, validMeasurementValue } from './measurement-rules';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function checkId(id: string) { if (!uuid.test(id)) throw new AppError('Invalid measurement or account.', 'VALIDATION'); }
export class MeasurementService {
  constructor(private readonly repository: MeasurementRepository) {}
  list(owner: string, offset: number, signal?: AbortSignal) {
    checkId(owner); if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError('Invalid page.', 'VALIDATION');
    return this.repository.list(owner, offset, signal);
  }
  get(owner: string, id: string, signal?: AbortSignal) { checkId(owner); checkId(id); return this.repository.get(owner, id, signal); }
  dashboard(period: ProgressPeriod, signal?: AbortSignal) {
    if (!['30d', '3m', '6m', '1y', 'all'].includes(period)) throw new AppError('Invalid time period.', 'VALIDATION');
    return this.repository.dashboard(period, signal);
  }
  preferredUnits(owner: string, signal?: AbortSignal) { checkId(owner); return this.repository.preferredUnits(owner, signal); }
  save(owner: string, input: MeasurementInput, id?: string) {
    checkId(owner); if (id) checkId(id); const timestamp = Date.parse(input.recordedAt);
    if (!Number.isFinite(timestamp) || !validMeasurementDate(input.recordedAt.slice(0, 10)) || input.recordedAt !== `${input.recordedAt.slice(0, 10)}T00:00:00.000Z` ||
      measurementFields.every((field) => input[field] === null) || measurementFields.some((field) => input[field] !== null && !validMeasurementValue(field, input[field]))) {
      throw new AppError('Check the measurement date and values.', 'VALIDATION');
    }
    return this.repository.save(owner, input, id);
  }
  remove(owner: string, id: string) { checkId(owner); checkId(id); return this.repository.remove(owner, id); }
}
