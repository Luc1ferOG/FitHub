import { measurementSchema } from '../measurement-schema';
import { emptyMeasurementForm } from '../../services/measurement-rules';
describe('measurement validation', () => {
  test('requires any measurement, not necessarily weight', () => {
    expect(measurementSchema('metric').safeParse({ ...emptyMeasurementForm(), waistCm: '90' }).success).toBe(true);
    expect(measurementSchema('metric').safeParse(emptyMeasurementForm()).success).toBe(false);
  });
  test('accepts imperial values and reports field-specific errors', () => {
    expect(measurementSchema('imperial').safeParse({ ...emptyMeasurementForm(), weightKg: '176.37', leftArmCm: '12.6' }).success).toBe(true);
    const result = measurementSchema('metric').safeParse({ ...emptyMeasurementForm(), weightKg: '-2', bodyFatPercentage: '150' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['weightKg', 'bodyFatPercentage']));
  });
  test('rejects invalid calendar dates and empty numeric garbage', () => {
    expect(measurementSchema('metric').safeParse({ ...emptyMeasurementForm(), date: '2020-02-30', weightKg: '80' }).success).toBe(false);
    expect(measurementSchema('metric').safeParse({ ...emptyMeasurementForm(), weightKg: 'NaN' }).success).toBe(false);
  });
});
