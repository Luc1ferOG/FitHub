import { z } from 'zod';
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Select a valid exercise');
export const challengeInputSchema = z.object({
  title: z.string().trim().min(1, 'Challenge title is required').max(150), description: z.string().trim().max(4000),
  metric: z.enum(['workout_count','volume_kg','repetitions','duration_seconds']),
  target: z.number().finite().positive('Target must be greater than zero').max(9999999999),
  startDate: z.iso.date('Use YYYY-MM-DD'), endDate: z.iso.date('Use YYYY-MM-DD'),
  visibility: z.enum(['public','friends','private']), exerciseId: uuid.nullable(),
}).superRefine((input, context) => {
  if (input.endDate < input.startDate) context.addIssue({ code:'custom', path:['endDate'], message:'End date must be on or after start date' });
  if (Date.parse(input.endDate) - Date.parse(input.startDate) > 366 * 86400000) context.addIssue({ code:'custom',path:['endDate'],message:'Challenges can last at most 367 calendar days' });
  if (input.metric === 'repetitions' && !input.exerciseId) context.addIssue({ code:'custom',path:['exerciseId'],message:'Choose the exercise to count' });
  if (input.metric !== 'repetitions' && input.exerciseId) context.addIssue({ code:'custom',path:['exerciseId'],message:'Only repetitions challenges select an exercise' });
  if (['workout_count','repetitions'].includes(input.metric) && !Number.isInteger(input.target)) context.addIssue({ code:'custom',path:['target'],message:'Use a whole-number target' });
});
export const challengeRowSchema = z.object({ id:uuid,creator_id:uuid,title:z.string(),description:z.string(),
  metric_type:z.enum(['workout_count','volume_kg','repetitions','duration_seconds','distance_m']),target_value:z.number().positive(),
  start_date:z.string(),end_date:z.string(),visibility:z.enum(['public','friends','private']),status:z.enum(['draft','active','completed','cancelled']),exercise_id:uuid.nullable() });
export const challengeDetailsSchema = z.object({ challenge:challengeRowSchema,creator:z.object({ id:uuid,display_name:z.string(),username:z.string() }),
  exercise_name:z.string().nullable(),participant_count:z.number().int().nonnegative(),invited:z.boolean(),
  membership:z.object({ user_id:uuid,current_value:z.number().nonnegative(),completed:z.boolean(),rank:z.number().int().positive().nullable(),left_at:z.string().nullable() }).nullable(),
  leaderboard:z.array(z.object({ user_id:uuid,display_name:z.string(),username:z.string(),avatar_url:z.string().nullable(),current_value:z.number().nonnegative(),rank:z.number().int().positive(),completed:z.boolean() })) });
