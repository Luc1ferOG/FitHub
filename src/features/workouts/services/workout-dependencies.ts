import { SupabaseWorkoutRepository } from '@/data/repositories/supabase/supabase-workout-repository';
import { OfflineWorkoutRepository } from '@/data/local/offline-workout-repository';
import { offlineCacheStorage } from '@/data/local/sqlite-offline-database';
import { offlineIdentityRepository } from '@/data/local/offline-identity-dependencies';
import { useAppStore } from '@/store/app-store';
import { WorkoutService } from './workout-service';

export const workoutService = new WorkoutService(new OfflineWorkoutRepository(
  new SupabaseWorkoutRepository(), offlineCacheStorage,
  () => offlineIdentityRepository.read()?.user.id ?? null,
  () => useAppStore.getState().isOffline,
));
