import { z } from 'zod';
import { fromCanonical, measurementUnit } from '@/utils/units';
import { fieldLabels, measurementBounds, parseMeasurementForm, validMeasurementDate, type MeasurementFormValues } from '../services/measurement-rules';
import { measurementFields, type UnitSystem } from '../types/measurement';
export function measurementSchema(units: UnitSystem) {
  const numericText = z.string().max(16, 'Value is too long.');
  return z.object({ date: z.string(), weightKg: numericText, bodyFatPercentage: numericText, chestCm: numericText, waistCm: numericText, hipsCm: numericText, leftArmCm: numericText, rightArmCm: numericText, leftThighCm: numericText, rightThighCm: numericText }).superRefine((values, ctx) => {
    if (!validMeasurementDate(values.date)) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Enter a real date (YYYY-MM-DD), not in the future.' });
    if (measurementFields.every((field) => !values[field].trim())) ctx.addIssue({ code: 'custom', path: ['weightKg'], message: 'Enter at least one measurement.' });
    for (const field of measurementFields) {
      if (!values[field].trim()) continue; const single: MeasurementFormValues = { ...values, date: '2000-01-01' };
      for (const other of measurementFields) if (other !== field) single[other] = '';
      try { parseMeasurementForm(single, units); } catch {
        const [min, max] = measurementBounds[field];
        ctx.addIssue({ code: 'custom', path: [field], message: `${fieldLabels[field]} must be ${fromCanonical(min, field, units).toFixed(1)}–${fromCanonical(max, field, units).toFixed(1)} ${measurementUnit(field, units)}.` });
      }
    }
  });
}
