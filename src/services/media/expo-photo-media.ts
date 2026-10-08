import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { AppError } from '@/domain/errors/app-error';
import type { PhotoMedia } from '@/features/progress/repositories/photo-media';
import type { LocalPhoto, PreparedImage } from '@/features/progress/types/progress-photo';
import { permissionDecision, permissionMessage, PHOTO_MAX_BYTES, resizedDimensions, THUMBNAIL_MAX_BYTES } from '@/features/progress/services/photo-rules';

export class ExpoPhotoMedia implements PhotoMedia {
  async pick(): Promise<LocalPhoto | null> {
    try {
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (permissionDecision(permission) === 'request') permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionDecision(permission) !== 'allowed') throw new AppError(permissionMessage('gallery', permission), 'AUTHORIZATION', { context: { openSettings: !permission.canAskAgain } });
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1, exif: false });
    if (result.canceled) return null; const asset = result.assets[0];
    if (!asset || (asset.fileSize ?? 0) > 64 * 1024 * 1024) throw new AppError('Choose a still image smaller than 64 MB.', 'VALIDATION');
    resizedDimensions(asset.width, asset.height, 1600);
    return { uri: asset.uri, width: asset.width, height: asset.height, owned: false };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Could not open your photo library. Try again or check device permissions.', 'UNKNOWN', { cause: error });
    }
  }
  private async render(photo: LocalPhoto, edge: number, quality: number): Promise<PreparedImage> {
    const dimensions = resizedDimensions(photo.width, photo.height, edge);
    const context = ImageManipulator.manipulate(photo.uri); context.resize(dimensions);
    let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
    let uri: string | undefined;
    try {
      rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: false }); uri = saved.uri;
      const file = new File(saved.uri); if (file.size > PHOTO_MAX_BYTES * 2) throw new AppError('Could not compress this image sufficiently.', 'VALIDATION');
      const bytes = await file.bytes(); const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
      return { bytes: buffer, width: saved.width, height: saved.height };
    } finally {
      rendered?.release(); context.release();
      if (uri) await this.cleanup({ ...photo, uri, owned: true });
    }
  }
  async prepare(photo: LocalPhoto) {
    try {
    let full = await this.render(photo, 1600, 0.75);
    if (full.bytes.byteLength > PHOTO_MAX_BYTES) full = await this.render(photo, 1000, 0.55);
    const thumbnail = await this.render(photo, 320, 0.65);
    if (full.bytes.byteLength > PHOTO_MAX_BYTES || thumbnail.bytes.byteLength > THUMBNAIL_MAX_BYTES) throw new AppError('This photo is still too large after compression. Choose a smaller image.', 'VALIDATION');
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, full.bytes);
    const checksum = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return { full, thumbnail, checksum };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Could not prepare this image. Try again or choose a different still photo.', 'UNKNOWN', { cause: error });
    }
  }
  async cleanup(photo: LocalPhoto) {
    if (!photo.owned || !photo.uri.startsWith(`${Paths.cache.uri.replace(/\/$/, '')}/`) || photo.uri.includes('/../')) return;
    try { const file = new File(photo.uri); if (file.exists) file.delete(); } catch { /* OS cache eviction is the fallback; never delete original gallery media. */ }
  }
}
