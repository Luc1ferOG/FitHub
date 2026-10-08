import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import { supabase } from '@/lib/supabase';
import type { BodyMeasurementRow, Database } from '@/types/database';
import type { MeasurementRepository } from '@/features/progress/repositories/measurement-repository';
import type { Measurement, MeasurementInput, ProgressPeriod, UnitSystem } from '@/features/progress/types/measurement';
import { progressResponse } from '@/features/progress/validation/progress-response';
import { localDate } from '@/features/progress/services/measurement-rules';
function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  throw new AppError(error.code === '23514' ? 'Check your measurement date and values.' : 'Could not save or load measurements. Check your connection and try again.', error.code === '23514' ? 'VALIDATION' : error.code === '42501' ? 'AUTHORIZATION' : 'NETWORK', { cause: error });
}
export function mapMeasurement(row: BodyMeasurementRow): Measurement {
  return { id: row.id, userId: row.user_id, recordedAt: row.recorded_at, weightKg: row.weight_kg,
    bodyFatPercentage: row.body_fat_percentage, chestCm: row.chest_cm, waistCm: row.waist_cm, hipsCm: row.hips_cm,
    leftArmCm: row.left_arm_cm, rightArmCm: row.right_arm_cm, leftThighCm: row.left_thigh_cm, rightThighCm: row.right_thigh_cm };
}
function toRow(input: MeasurementInput) {
  return { recorded_at: input.recordedAt, weight_kg: input.weightKg, body_fat_percentage: input.bodyFatPercentage,
    chest_cm: input.chestCm, waist_cm: input.waistCm, hips_cm: input.hipsCm, left_arm_cm: input.leftArmCm,
    right_arm_cm: input.rightArmCm, left_thigh_cm: input.leftThighCm, right_thigh_cm: input.rightThighCm };
}
export class SupabaseMeasurementRepository implements MeasurementRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async list(owner: string, offset: number, signal?: AbortSignal) {
    let query = this.client.from('body_measurements').select('*').eq('user_id', owner)
      .order('recorded_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 20);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; check(error);
    return { entries: (data ?? []).slice(0, 20).map(mapMeasurement), nextOffset: (data?.length ?? 0) > 20 ? offset + 20 : null };
  }
  async get(owner: string, id: string, signal?: AbortSignal) {
    let query = this.client.from('body_measurements').select('*').eq('user_id', owner).eq('id', id);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle(); check(error);
    if (!data) throw new AppError('This measurement is no longer available.', 'NOT_FOUND');
    return mapMeasurement(data);
  }
  async dashboard(period: ProgressPeriod, signal?: AbortSignal) {
    let query = this.client.rpc('get_body_progress', { p_period: period, p_today: localDate() }); if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; check(error); return progressResponse.parse(data);
  }
  async preferredUnits(owner: string, signal?: AbortSignal): Promise<UnitSystem> {
    let query = this.client.from('profiles').select('preferred_units').eq('id', owner); if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle(); check(error);
    if (!data) throw new AppError('Your profile is not available.', 'AUTHORIZATION');
    return data.preferred_units;
  }
  async save(owner: string, input: MeasurementInput, id?: string) {
    const query = id ? this.client.from('body_measurements').update(toRow(input)).eq('user_id', owner).eq('id', id)
      : this.client.from('body_measurements').insert({ ...toRow(input), user_id: owner });
    const { data, error } = await query.select('*').maybeSingle(); check(error);
    if (!data) throw new AppError('This measurement could not be saved for your account.', 'NOT_FOUND');
    return mapMeasurement(data);
  }
  async remove(owner: string, id: string) {
    const { data, error } = await this.client.from('body_measurements').delete().eq('user_id', owner).eq('id', id).select('id'); check(error);
    if (!data?.length) throw new AppError('This measurement is no longer available.', 'NOT_FOUND');
  }
}
