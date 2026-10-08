import { SupabasePhotoRepository, SupabasePhotoStorageRepository } from '@/data/repositories/supabase/supabase-photo-repository';
import { ExpoPhotoMedia } from '@/services/media/expo-photo-media';
import { PhotoService } from './photo-service';
export const photoService = new PhotoService(new SupabasePhotoRepository(), new SupabasePhotoStorageRepository());
export const photoMedia = new ExpoPhotoMedia();
