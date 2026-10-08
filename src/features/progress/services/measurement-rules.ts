import { AppError } from '@/domain/errors/app-error';
import { fromCanonical, measurementUnit, toCanonical } from '@/utils/units';
import { measurementFields, type MeasurementField, type MeasurementInput, type MetricSummary, type UnitSystem } from '../types/measurement';
export const fieldLabels: Record<MeasurementField, string> = { weightKg: 'Body weight', bodyFatPercentage: 'Body fat', chestCm: 'Chest', waistCm: 'Waist', hipsCm: 'Hips', leftArmCm: 'Left arm', rightArmCm: 'Right arm', leftThighCm: 'Left thigh', rightThighCm: 'Right thigh' };
// Broad adult safety bounds, not diagnostic or goal ranges.
export const measurementBounds: Record<MeasurementField, readonly [number, number]> = {
  weightKg: [20, 500], bodyFatPercentage: [1, 75], chestCm: [20, 300], waistCm: [20, 300], hipsCm: [20, 300],
  leftArmCm: [5, 100], rightArmCm: [5, 100], leftThighCm: [10, 200], rightThighCm: [10, 200],
};
export type MeasurementFormValues = Record<MeasurementField, string> & { date: string };
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validMeasurementDate(date: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date >= '1900-01-01' && date <= localDate(now);
}
export function validMeasurementValue(field: MeasurementField, value: number): boolean {
  const [min, max] = measurementBounds[field]; return Number.isFinite(value) && value >= min && value <= max;
}
export function emptyMeasurementForm(now = new Date()): MeasurementFormValues {
  return { date: localDate(now), weightKg: '', bodyFatPercentage: '', chestCm: '', waistCm: '', hipsCm: '', leftArmCm: '', rightArmCm: '', leftThighCm: '', rightThighCm: '' };
}
export function measurementToForm(input: MeasurementInput, units: UnitSystem): MeasurementFormValues {
  const result = emptyMeasurementForm(); result.date = input.recordedAt.slice(0, 10);
  for (const field of measurementFields) { const value = input[field]; result[field] = value === null ? '' : String(Number(fromCanonical(value, field, units).toFixed(2))); }
  return result;
}
export function parseMeasurementForm(values: MeasurementFormValues, units: UnitSystem, now = new Date()): MeasurementInput {
  if (!validMeasurementDate(values.date, now)) throw new AppError('Choose a valid date, not in the future.', 'VALIDATION');
  const result: MeasurementInput = { recordedAt: `${values.date}T00:00:00.000Z`, weightKg: null, bodyFatPercentage: null, chestCm: null, waistCm: null, hipsCm: null, leftArmCm: null, rightArmCm: null, leftThighCm: null, rightThighCm: null };
  for (const field of measurementFields) {
    const text = values[field].trim(); if (!text) continue;
    if (!/^\d+(?:[.,]\d+)?$/.test(text)) throw new AppError(`${fieldLabels[field]} must be a number.`, 'VALIDATION');
    const value = toCanonical(Number(text.replace(',', '.')), field, units); const [min, max] = measurementBounds[field];
    const tolerance = Math.abs(toCanonical(0.0051, field, units));
    if (value < min - tolerance || value > max + tolerance || !Number.isFinite(value)) throw new AppError(`${fieldLabels[field]} is outside the supported range.`, 'VALIDATION');
    result[field] = Number(Math.min(max, Math.max(min, value)).toFixed(2));
  }
  if (measurementFields.every((field) => result[field] === null)) throw new AppError('Enter at least one measurement.', 'VALIDATION');
  return result;
}
export function summaryChanges(summary: MetricSummary): { previous: number | null; starting: number | null } {
  const difference = (baseline: number | null) => summary.latest === null || baseline === null ? null : Number((summary.latest - baseline).toFixed(4));
  return { previous: difference(summary.previous), starting: difference(summary.starting) };
}
export function formToMeasurement(values: MeasurementFormValues, units: UnitSystem, original?: MeasurementInput): MeasurementInput {
  const result = parseMeasurementForm(values, units);
  if (original) {
    const displayed = measurementToForm(original, units);
    for (const field of measurementFields) if (values[field] === displayed[field]) result[field] = original[field];
  }
  return result;
}
export function formatMeasurement(value: number | null, field: MeasurementField, units: UnitSystem, signed = false): string {
  if (value === null) return '—'; const converted = fromCanonical(value, field, units);
  return `${signed && converted > 0 ? '+' : ''}${converted.toFixed(1)} ${measurementUnit(field, units)}`;
}
export function chartGeometry(points: readonly { date: string; value: number }[], width: number, height: number) {
  if (!points.length) return [];
  const values = points.map((point) => point.value); const min = Math.min(...values); const max = Math.max(...values);
  const times = points.map((point) => Date.parse(point.date)); const first = times[0] ?? 0; const last = times[times.length - 1] ?? first;
  return points.map((point, index) => ({ x: last === first ? width / 2 : ((times[index] ?? first) - first) / (last - first) * width,
    y: max === min ? height / 2 : height - (point.value - min) / (max - min) * height }));
}
