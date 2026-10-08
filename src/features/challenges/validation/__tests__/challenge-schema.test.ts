import { challengeInputSchema } from '../challenge-schema';
const valid = { title:'12 workouts',description:'',metric:'workout_count',target:12,startDate:'2026-10-07',endDate:'2026-10-31',visibility:'public',exerciseId:null };
describe('challenge creation validation',() => {
  it('accepts the required four types with exercise-scoped repetitions',() => {
    for (const metric of ['workout_count','volume_kg','duration_seconds']) expect(challengeInputSchema.safeParse({ ...valid,metric }).success).toBe(true);
    expect(challengeInputSchema.safeParse({ ...valid,metric:'repetitions',exerciseId:'10000000-0000-0000-0000-000000000006' }).success).toBe(true);
  });
  it.each([{ title:'' },{ target:0 },{ target:-1 },{ target:NaN },{ target:1.5 },{ endDate:'2026-10-06' },{ startDate:'2026-02-30' },{ endDate:'2028-01-01' },{ metric:'repetitions',exerciseId:null },{ metric:'distance_m' }])('rejects invalid input %j',(changes) => { expect(challengeInputSchema.safeParse({ ...valid,...changes }).success).toBe(false); });
  it('requires only repetitions to select an exercise',() => { expect(challengeInputSchema.safeParse({ ...valid,exerciseId:'10000000-0000-0000-0000-000000000006' }).success).toBe(false); });
});
