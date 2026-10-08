export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type ExerciseSummary = {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  difficulty: ExerciseDifficulty;
  thumbnailUrl: string | null;
};

export type Exercise = ExerciseSummary & {
  description: string;
  instructions: readonly string[];
  secondaryMuscles: readonly string[];
  formTips: readonly string[];
  commonMistakes: readonly string[];
  videoUrl: string | null;
};

export type ExerciseFilters = {
  search: string;
  muscle: string | null;
  equipment: string | null;
  difficulty: ExerciseDifficulty | null;
};

export type ExercisePage = {
  items: readonly ExerciseSummary[];
  nextOffset: number | null;
};

export type ExerciseFilterOptions = {
  muscles: string[];
  equipment: string[];
};
