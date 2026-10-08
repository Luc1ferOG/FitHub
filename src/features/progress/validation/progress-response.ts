import { z } from 'zod';
const value = z.number().finite().nullable();
const summary = z.object({ latest: value, previous: value, starting: value, recordedAt: z.string().nullable() });
export const progressResponse = z.object({ count: z.number().int().nonnegative(), summaries: z.object({
  weightKg: summary, bodyFatPercentage: summary, chestCm: summary, waistCm: summary, hipsCm: summary,
  leftArmCm: summary, rightArmCm: summary, leftThighCm: summary, rightThighCm: summary,
}), points: z.array(z.object({ date: z.string(), weightKg: value, waistCm: value, bodyFatPercentage: value })).max(120) });
