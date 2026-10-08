import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { useExercise } from '../../hooks/use-exercises';
import { ExerciseDetailScreen } from '../exercise-screens';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ exerciseId: '10000000-0000-0000-0000-000000000001' }),
  Stack: { Screen: () => null },
}));
jest.mock('../../hooks/use-exercises', () => ({ useExercise: jest.fn() }));
jest.mock('../../components/exercise-video', () => ({ ExerciseVideo: () => null }));

describe('exercise detail guide', () => {
  it('requests the route ID and renders all coaching sections', () => {
    const data = {
      id: '10000000-0000-0000-0000-000000000001', name: 'Back Squat',
      description: 'A lower-body exercise.', primaryMuscle: 'quadriceps', secondaryMuscles: ['glutes'],
      equipment: 'barbell', difficulty: 'intermediate' as const, thumbnailUrl: null, videoUrl: null,
      instructions: ['Brace your trunk.'], formTips: ['Keep the heel grounded.'], commonMistakes: ['Knees collapsing inward.'],
    };
    jest.mocked(useExercise).mockReturnValue({ data, error: null, isPending: false, fetchStatus: 'idle' } as ReturnType<typeof useExercise>);
    render(<AppThemeProvider><ExerciseDetailScreen /></AppThemeProvider>);
    expect(useExercise).toHaveBeenCalledWith(data.id);
    expect(screen.getByText('Primary muscle: quadriceps')).toBeTruthy();
    expect(screen.getByText('Secondary muscles: glutes')).toBeTruthy();
    expect(screen.getByLabelText('Step 1: Brace your trunk.')).toBeTruthy();
    expect(screen.getByText('Keep the heel grounded.')).toBeTruthy();
    expect(screen.getByText('Knees collapsing inward.')).toBeTruthy();
  });
});
