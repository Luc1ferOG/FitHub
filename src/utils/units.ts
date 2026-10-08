import type { MeasurementField, UnitSystem } from '@/features/progress/types/measurement';
const POUNDS_PER_KILOGRAM = 2.2046226218487757;
const CENTIMETRES_PER_INCH = 2.54;
export const kilogramsToPounds = (value: number): number => value * POUNDS_PER_KILOGRAM;
export const poundsToKilograms = (value: number): number => value / POUNDS_PER_KILOGRAM;
export const centimetresToInches = (value: number): number => value / CENTIMETRES_PER_INCH;
export const inchesToCentimetres = (value: number): number => value * CENTIMETRES_PER_INCH;
export function fromCanonical(value: number, field: MeasurementField, units: UnitSystem): number {
  if (units === 'metric' || field === 'bodyFatPercentage') return value;
  return field === 'weightKg' ? kilogramsToPounds(value) : centimetresToInches(value);
}
export function toCanonical(value: number, field: MeasurementField, units: UnitSystem): number {
  if (units === 'metric' || field === 'bodyFatPercentage') return value;
  return field === 'weightKg' ? poundsToKilograms(value) : inchesToCentimetres(value);
}
export function measurementUnit(field: MeasurementField, units: UnitSystem): string {
  return field === 'bodyFatPercentage' ? '%' : field === 'weightKg' ? units === 'metric' ? 'kg' : 'lb' : units === 'metric' ? 'cm' : 'in';
}
