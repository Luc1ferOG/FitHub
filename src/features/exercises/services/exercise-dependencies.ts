import { SupabaseExerciseRepository } from '@/data/repositories/supabase/supabase-exercise-repository';

import { ExerciseService } from './exercise-service';

export const exerciseService = new ExerciseService(new SupabaseExerciseRepository());
