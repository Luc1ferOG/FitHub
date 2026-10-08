import type { Measurement, MeasurementInput, MeasurementPage, ProgressDashboard, ProgressPeriod, UnitSystem } from '../types/measurement';
export interface MeasurementRepository {
  list(owner: string, offset: number, signal?: AbortSignal): Promise<MeasurementPage>;
  get(owner: string, id: string, signal?: AbortSignal): Promise<Measurement>;
  dashboard(period: ProgressPeriod, signal?: AbortSignal): Promise<ProgressDashboard>;
  preferredUnits(owner: string, signal?: AbortSignal): Promise<UnitSystem>;
  save(owner: string, input: MeasurementInput, id?: string): Promise<Measurement>;
  remove(owner: string, id: string): Promise<void>;
}
