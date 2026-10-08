import { measurementFields } from '@/features/progress/types/measurement';
import { centimetresToInches, fromCanonical, inchesToCentimetres, kilogramsToPounds, measurementUnit, poundsToKilograms, toCanonical } from '../units';

describe('canonical measurement units', () => {
  it.each([0, 20, 80.1234, 500])('round-trips %s kg without rounding stored values', (value) => {
    expect(poundsToKilograms(kilogramsToPounds(value))).toBeCloseTo(value, 10);
  });
  it('converts known mass/length values', () => {
    expect(kilogramsToPounds(80)).toBeCloseTo(176.3698097479, 8);
    expect(inchesToCentimetres(10)).toBe(25.4);
    expect(centimetresToInches(25.4)).toBeCloseTo(10, 10);
  });
  it.each(measurementFields)('preserves %s across metric/imperial round trips', (field) => {
    expect(toCanonical(fromCanonical(80.1234, field, 'imperial'), field, 'imperial')).toBeCloseTo(80.1234, 10);
    expect(fromCanonical(80, field, 'metric')).toBe(80);
    expect(toCanonical(80, field, 'metric')).toBe(80);
  });
  it('never converts percentages and labels independent arm/thigh measures correctly', () => {
    expect(fromCanonical(22, 'bodyFatPercentage', 'imperial')).toBe(22);
    expect(measurementUnit('bodyFatPercentage', 'imperial')).toBe('%');
    expect(measurementUnit('leftArmCm', 'metric')).toBe('cm');
    expect(measurementUnit('rightThighCm', 'imperial')).toBe('in');
    expect(measurementUnit('weightKg', 'metric')).toBe('kg');
    expect(measurementUnit('weightKg', 'imperial')).toBe('lb');
  });
});
