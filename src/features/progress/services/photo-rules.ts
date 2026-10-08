import { AppError } from '@/domain/errors/app-error';
import { validMeasurementDate } from './measurement-rules';
import { measurementFields, type MeasurementValues } from '../types/measurement';
import type { PermissionDecision, PermissionState, PhotoMetadata, ProgressPhoto } from '../types/progress-photo';
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const THUMBNAIL_MAX_BYTES = 512 * 1024;
export const PHOTO_URL_SECONDS = 300;
export function permissionDecision(state: PermissionState | null): PermissionDecision {
  if (state?.granted || state?.accessPrivileges === 'limited') return 'allowed';
  return state && !state.canAskAgain ? 'settings' : 'request';
}
export function permissionMessage(kind: 'camera' | 'gallery', state: PermissionState): string {
  if (state.status === 'undetermined') return kind === 'camera' ? 'Allow camera access to take a private progress photo.' : 'Allow photo-library access to choose a progress photo.';
  return `${kind === 'camera' ? 'Camera' : 'Photo library'} access was denied. ${state.canAskAgain ? 'You can try allowing access again.' : 'Open your device settings to allow access.'}`;
}
export function photoPaths(owner: string, id: string) { return { full: `${owner}/${id}/full.jpg`, thumbnail: `${owner}/${id}/thumbnail.jpg` }; }
export function validatePhotoMetadata(metadata: PhotoMetadata, now = new Date()): PhotoMetadata {
  if (!validMeasurementDate(metadata.date, now)) throw new AppError('Enter a real date (YYYY-MM-DD), not in the future.', 'VALIDATION');
  if (!['front', 'side', 'back'].includes(metadata.pose)) throw new AppError('Choose front, side or back.', 'VALIDATION');
  if (metadata.notes.length > 1000) throw new AppError('Notes must be 1,000 characters or fewer.', 'VALIDATION');
  return { ...metadata, notes: metadata.notes.trim() };
}
export function resizedDimensions(width: number, height: number, longestEdge: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > 60000000) throw new AppError('This image is too large or could not be read. Choose a smaller image.', 'VALIDATION');
  const scale = Math.min(1, longestEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function orderedComparison(first: ProgressPhoto, second: ProgressPhoto) {
  if (first.id === second.id) throw new AppError('Choose two different photos.', 'VALIDATION');
  const sorted = [first, second].sort((a, b) => a.takenAt.localeCompare(b.takenAt) || a.id.localeCompare(b.id));
  const before = sorted[0]; const after = sorted[1];
  if (!before || !after) throw new AppError('Choose two photos.', 'VALIDATION');
  return { before, after, days: Math.round((Date.parse(`${after.takenAt.slice(0, 10)}T00:00:00Z`) - Date.parse(`${before.takenAt.slice(0, 10)}T00:00:00Z`)) / 86400000) };
}
export function comparisonChanges(before: MeasurementValues | null, after: MeasurementValues | null): MeasurementValues {
  return Object.fromEntries(measurementFields.map((field) => {
    const first = before?.[field] ?? null; const second = after?.[field] ?? null;
    return [field, first === null || second === null ? null : Number((second - first).toFixed(4))];
  })) as MeasurementValues;
}
export function photoGridRows(photos: readonly ProgressPhoto[]): { key: string; date: string; photos: ProgressPhoto[]; heading: boolean }[] {
  const rows: { key: string; date: string; photos: ProgressPhoto[]; heading: boolean }[] = [];
  for (const photo of photos) {
    const date = photo.takenAt.slice(0, 10); const previous = rows[rows.length - 1];
    if (previous && previous.date === date && previous.photos.length < 2) previous.photos.push(photo);
    else rows.push({ key: photo.id, date, photos: [photo], heading: !previous || previous.date !== date });
  }
  return rows;
}
