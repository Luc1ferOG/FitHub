import type { MeasurementValues } from '../types/measurement';
import type { PhotoMetadata, PhotoPage, ProgressPhoto } from '../types/progress-photo';
export interface PhotoRepository {
  list(owner: string, offset: number, signal?: AbortSignal): Promise<PhotoPage>;
  get(owner: string, id: string, signal?: AbortSignal): Promise<ProgressPhoto>;
  reserve(owner: string, id: string, metadata: PhotoMetadata, checksum: string): Promise<ProgressPhoto>;
  finish(id: string): Promise<ProgressPhoto>;
  markDeleting(id: string): Promise<ProgressPhoto | null>;
  finishDeleting(id: string): Promise<void>;
  measurementsOnDate(owner: string, date: string, signal?: AbortSignal): Promise<MeasurementValues | null>;
}
export interface PhotoStorageRepository {
  upload(path: string, bytes: ArrayBuffer): Promise<void>;
  remove(paths: string[]): Promise<void>;
  signedUrl(path: string): Promise<string>;
}
