import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { exerciseService } from '../../services/exercise-dependencies';
import type { ExerciseSummary } from '../../types/exercise';
import { ExerciseLibraryScreen } from '../exercise-library-screen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: mockPush }), Stack: { Screen: () => null },
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../services/exercise-dependencies', () => ({
  exerciseService: { list: jest.fn(), getFilterOptions: jest.fn() },
}));

const fixtures: ExerciseSummary[] = [
  { id: '10000000-0000-0000-0000-000000000001', name: 'Back Squat', primaryMuscle: 'quadriceps', equipment: 'barbell', difficulty: 'intermediate', thumbnailUrl: null },
  { id: '10000000-0000-0000-0000-000000000006', name: 'Push-Up', primaryMuscle: 'chest', equipment: 'bodyweight', difficulty: 'beginner', thumbnailUrl: null },
];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><AppThemeProvider><ExerciseLibraryScreen /></AppThemeProvider></QueryClientProvider>);
  return { ...view, client };
}

describe('exercise library interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(exerciseService.getFilterOptions).mockResolvedValue({ muscles: ['chest', 'quadriceps'], equipment: ['barbell', 'bodyweight'] });
    jest.mocked(exerciseService.list).mockImplementation(async (filters) => ({
      items: fixtures.filter((exercise) =>
        exercise.name.toLowerCase().includes(filters.search)
        && (!filters.muscle || exercise.primaryMuscle === filters.muscle)
        && (!filters.equipment || exercise.equipment === filters.equipment)
        && (!filters.difficulty || exercise.difficulty === filters.difficulty)),
      nextOffset: null,
    }));
  });

  it('debounces search and shows matching results', async () => {
    jest.useFakeTimers();
    const view = setup();
    try {
      await screen.findByText('Back Squat');
      fireEvent.changeText(screen.getByLabelText('Search exercises'), 'squat');
      expect(screen.getByText('Push-Up')).toBeTruthy(); // Keep rows mounted during debounce.
      expect(screen.getByText('Updating search…')).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(300); });
      await waitFor(() => expect(screen.getByText('Back Squat')).toBeTruthy());
      expect(screen.queryByText('Push-Up')).toBeNull();
      expect(exerciseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'squat' }), 0, expect.any(AbortSignal));
    } finally {
      view.unmount(); view.client.clear(); jest.useRealTimers();
    }
  });

  it('combines filters and clears them from the empty state', async () => {
    const view = setup();
    await screen.findByText('Back Squat');
    fireEvent.press(await screen.findByRole('button', { name: 'Muscle: quadriceps' }));
    fireEvent.press(screen.getByRole('button', { name: 'Equipment: barbell' }));
    fireEvent.press(screen.getByRole('button', { name: 'Difficulty: beginner' }));
    await screen.findByText('No exercises found');
    expect(exerciseService.list).toHaveBeenLastCalledWith(expect.objectContaining({
      muscle: 'quadriceps', equipment: 'barbell', difficulty: 'beginner',
    }), 0, expect.any(AbortSignal));
    fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText('Push-Up');
    view.unmount(); view.client.clear();
  });

  it('opens the selected exercise detail route', async () => {
    const view = setup();
    const card = await screen.findByRole('button', { name: /Back Squat\. Primary muscle/ });
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/exercises/[exerciseId]', params: { exerciseId: fixtures[0]?.id },
    });
    view.unmount(); view.client.clear();
  });
});
