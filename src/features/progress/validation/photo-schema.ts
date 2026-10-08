import { z } from 'zod';
import { validMeasurementDate } from '../services/measurement-rules';
export const photoMetadataSchema = z.object({ date: z.string().refine((date) => validMeasurementDate(date), 'Enter a real date (YYYY-MM-DD), not in the future.'), pose: z.enum(['front', 'side', 'back']), notes: z.string().max(1000, 'Notes must be 1,000 characters or fewer.') });
export const photoRowSchema = z.object({
  id: z.string(), user_id: z.string(), photo_url: z.string(), thumbnail_url: z.string().nullable(), pose_type: z.enum(['front', 'side', 'back', 'other']),
  taken_at: z.string(), notes: z.string(), is_private: z.literal(true), upload_status: z.enum(['pending', 'ready', 'deleting']), upload_checksum: z.string().nullable(),
});
const measurementValue = z.number().finite().nullable();
export const photoMeasurementsSchema = z.object({ weightKg: measurementValue, bodyFatPercentage: measurementValue, chestCm: measurementValue, waistCm: measurementValue, hipsCm: measurementValue, leftArmCm: measurementValue, rightArmCm: measurementValue, leftThighCm: measurementValue, rightThighCm: measurementValue });
