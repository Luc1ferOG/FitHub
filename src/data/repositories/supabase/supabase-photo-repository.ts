import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import { supabase } from '@/lib/supabase';
import type { Database, ProgressPhotoRow } from '@/types/database';
import type { PhotoRepository, PhotoStorageRepository } from '@/features/progress/repositories/photo-repository';
import type { PhotoMetadata, ProgressPhoto } from '@/features/progress/types/progress-photo';
import { PHOTO_MAX_BYTES, PHOTO_URL_SECONDS } from '@/features/progress/services/photo-rules';
import { photoMeasurementsSchema, photoRowSchema } from '@/features/progress/validation/photo-schema';
function check(error: { message: string; code?: string } | null) {
  if (!error) return;
  const code = error.code === '40001' ? 'CONFLICT' : error.code === '42501' ? 'AUTHORIZATION' : error.code === '22023' ? 'VALIDATION' : 'NETWORK';
  throw new AppError(code === 'CONFLICT' ? 'This photo operation changed. Retry deletion, or discard the incomplete upload before starting again.' : code === 'AUTHORIZATION' ? 'This photo is not available to your account.' : 'Could not complete the photo operation. Check your connection and try again.', code, { cause: error });
}
export function mapPhoto(row: ProgressPhotoRow): ProgressPhoto {
  return { id: row.id, userId: row.user_id, photoPath: row.photo_url, thumbnailPath: row.thumbnail_url, takenAt: row.taken_at, pose: row.pose_type, notes: row.notes, status: row.upload_status, checksum: row.upload_checksum };
}
export class SupabasePhotoRepository implements PhotoRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async list(owner: string, offset: number, signal?: AbortSignal) {
    let query = this.client.from('progress_photos').select('*').eq('user_id', owner).order('taken_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 20);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; check(error);
    return { entries: (data ?? []).slice(0, 20).map(mapPhoto), nextOffset: (data?.length ?? 0) > 20 ? offset + 20 : null };
  }
  async get(owner: string, id: string, signal?: AbortSignal) {
    let query = this.client.from('progress_photos').select('*').eq('user_id', owner).eq('id', id); if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle(); check(error);
    if (!data) throw new AppError('This photo has been removed or is unavailable.', 'NOT_FOUND'); return mapPhoto(data);
  }
  async reserve(owner: string, id: string, metadata: PhotoMetadata, checksum: string) {
    const { data, error } = await this.client.rpc('reserve_progress_photo', { p_user: owner, p_id: id, p_date: metadata.date, p_pose: metadata.pose, p_notes: metadata.notes, p_checksum: checksum }); check(error);
    if (!data) throw new AppError('Could not start the upload.', 'NETWORK'); return mapPhoto(photoRowSchema.parse(data));
  }
  async finish(id: string) { const { data, error } = await this.client.rpc('finish_progress_photo', { p_id: id }); check(error); if (!data) throw new AppError('Could not finish the upload.', 'NETWORK'); return mapPhoto(photoRowSchema.parse(data)); }
  async markDeleting(id: string) { const { data, error } = await this.client.rpc('begin_delete_progress_photo', { p_id: id }); check(error); return data ? mapPhoto(photoRowSchema.parse(data)) : null; }
  async finishDeleting(id: string) { const { error } = await this.client.rpc('finish_delete_progress_photo', { p_id: id }); check(error); }
  async measurementsOnDate(owner: string, date: string, signal?: AbortSignal) {
    let query = this.client.rpc('get_photo_date_measurements', { p_user: owner, p_day: date });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; check(error); return data ? photoMeasurementsSchema.parse(data) : null;
  }
}
export class SupabasePhotoStorageRepository implements PhotoStorageRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async upload(path: string, bytes: ArrayBuffer) {
    if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) throw new AppError('This image is too large to upload.', 'VALIDATION');
    const { error } = await this.client.storage.from('progress-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
    // A retry after an uncertain response is safe: the reservation's immutable checksum identifies the same bytes.
    if (error && (('statusCode' in error && String(error.statusCode) === '409') || ('status' in error && String(error.status) === '409'))) return;
    if (error) throw new AppError('Photo upload failed. Check your connection and retry. You can discard incomplete uploads in the gallery.', 'NETWORK', { cause: error });
  }
  async remove(paths: string[]) { const { error } = await this.client.storage.from('progress-photos').remove(paths); if (error) throw new AppError('The photo could not be deleted. Check your connection and retry deletion in the gallery.', 'NETWORK', { cause: error }); }
  async signedUrl(path: string) {
    const { data, error } = await this.client.storage.from('progress-photos').createSignedUrl(path, PHOTO_URL_SECONDS);
    if (error || !data?.signedUrl) throw new AppError('Could not load this private photo. Check your connection and retry.', 'NETWORK', { cause: error });
    return data.signedUrl;
  }
}
