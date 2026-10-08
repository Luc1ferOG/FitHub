import { AppError } from '@/domain/errors/app-error';
import type { PhotoRepository, PhotoStorageRepository } from '../repositories/photo-repository';
import type { PhotoMetadata, PreparedPhoto, ProgressPhoto } from '../types/progress-photo';
import { orderedComparison, PHOTO_MAX_BYTES, THUMBNAIL_MAX_BYTES, validatePhotoMetadata } from './photo-rules';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function checkId(value: string) { if (!uuid.test(value)) throw new AppError('Invalid photo or account.', 'VALIDATION'); }
function checkOwnership(photo: ProgressPhoto, owner: string) {
  if (photo.userId !== owner || !photo.photoPath.startsWith(`${owner}/`) || photo.photoPath.includes('..') || (photo.thumbnailPath && (!photo.thumbnailPath.startsWith(`${owner}/`) || photo.thumbnailPath.includes('..')))) throw new AppError('This photo is not available to your account.', 'AUTHORIZATION');
}
export class PhotoService {
  constructor(private readonly repository: PhotoRepository, private readonly storage: PhotoStorageRepository) {}
  list(owner: string, offset: number, signal?: AbortSignal) { checkId(owner); if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError('Invalid photo page.', 'VALIDATION'); return this.repository.list(owner, offset, signal); }
  async get(owner: string, id: string, signal?: AbortSignal) { checkId(owner); checkId(id); const photo = await this.repository.get(owner, id, signal); checkOwnership(photo, owner); return photo; }
  async upload(owner: string, id: string, metadata: PhotoMetadata, prepared: PreparedPhoto) {
    checkId(owner); checkId(id); const clean = validatePhotoMetadata(metadata);
    if (!/^[0-9a-f]{64}$/.test(prepared.checksum) || prepared.full.bytes.byteLength > PHOTO_MAX_BYTES || prepared.thumbnail.bytes.byteLength > THUMBNAIL_MAX_BYTES || prepared.full.bytes.byteLength < 3 || prepared.thumbnail.bytes.byteLength < 3) throw new AppError('The optimized image is too large or invalid. Choose another photo.', 'VALIDATION');
    for (const image of [prepared.full, prepared.thumbnail]) {
      const bytes = new Uint8Array(image.bytes);
      if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || Math.max(image.width, image.height) > 1600) throw new AppError('Select a valid optimized JPEG image.', 'VALIDATION');
    }
    const photo = await this.repository.reserve(owner, id, clean, prepared.checksum); checkOwnership(photo, owner);
    if (photo.status === 'ready') return photo;
    if (photo.status !== 'pending') throw new AppError('This photo is being deleted. Start a new upload.', 'CONFLICT');
    await this.storage.upload(photo.photoPath, prepared.full.bytes);
    if (!photo.thumbnailPath) throw new AppError('The upload has no thumbnail path.', 'VALIDATION');
    await this.storage.upload(photo.thumbnailPath, prepared.thumbnail.bytes);
    return this.repository.finish(id);
  }
  async remove(owner: string, id: string) {
    checkId(owner); checkId(id); const photo = await this.repository.markDeleting(id); if (!photo) return;
    checkOwnership(photo, owner);
    await this.storage.remove([photo.photoPath, ...(photo.thumbnailPath ? [photo.thumbnailPath] : [])]);
    await this.repository.finishDeleting(id);
  }
  async signedUrl(owner: string, id: string, thumbnail: boolean) {
    const photo = await this.get(owner, id);
    return this.urlForPhoto(owner, photo, thumbnail);
  }
  urlForPhoto(owner: string, photo: ProgressPhoto, thumbnail: boolean) {
    checkId(owner); checkOwnership(photo, owner);
    if (photo.status !== 'ready') throw new AppError('This upload is incomplete or is being deleted.', 'CONFLICT');
    // Do not decode the original in a grid for a missing legacy thumbnail.
    const path = thumbnail ? photo.thumbnailPath : photo.photoPath;
    if (!path) throw new AppError('The thumbnail is unavailable. Open the photo to view it.', 'NOT_FOUND');
    return this.storage.signedUrl(path);
  }
  async compare(owner: string, firstId: string, secondId: string, signal?: AbortSignal) {
    const [first, second] = await Promise.all([this.get(owner, firstId, signal), this.get(owner, secondId, signal)]);
    if (first.status !== 'ready' || second.status !== 'ready') throw new AppError('Only completed uploads can be compared.', 'VALIDATION');
    const comparison = orderedComparison(first, second);
    const [beforeMeasurements, afterMeasurements] = await Promise.all([this.repository.measurementsOnDate(owner, comparison.before.takenAt.slice(0, 10), signal), this.repository.measurementsOnDate(owner, comparison.after.takenAt.slice(0, 10), signal)]);
    return { ...comparison, beforeMeasurements, afterMeasurements };
  }
}
