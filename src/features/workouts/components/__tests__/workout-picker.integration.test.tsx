import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { exerciseService } from '@/features/exercises/services/exercise-dependencies';
import { WorkoutBuilder } from '../workout-builder';

jest.mock('@/features/exercises/services/exercise-dependencies', () => ({ exerciseService: { list: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ['enabled', 'activeOffsetY', 'activateAfterLongPress', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) chain[method] = jest.fn(() => chain);
  return { Gesture: { Pan: () => chain }, GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children };
});

it('adds a library exercise through the real picker, configures it and saves a validated workout', async () => {
  jest.mocked(exerciseService.list).mockResolvedValue({ items: [{ id: '10000000-0000-0000-0000-000000000001', name: 'Back Squat', primaryMuscle: 'quadriceps', equipment: 'barbell', difficulty: 'intermediate', thumbnailUrl: null }], nextOffset: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const save = jest.fn().mockResolvedValue(undefined);
  const view = render(<QueryClientProvider client={client}><AppThemeProvider><WorkoutBuilder busy={false} error={null} onSave={save} /></AppThemeProvider></QueryClientProvider>);
  try {
    fireEvent.changeText(screen.getByLabelText('Workout name'), 'Full body');
    fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
    fireEvent.press(await screen.findByRole('button', { name: /Back Squat.*Primary muscle/ }));
    expect(screen.queryByLabelText('Find an exercise to add')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Target sets'), '2');
    fireEvent.changeText(screen.getByLabelText('Target reps'), '12');
    fireEvent.changeText(screen.getByLabelText('Target weight (kg, optional)'), '20');
    fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Full body', exercises: [expect.objectContaining({ exerciseId: '10000000-0000-0000-0000-000000000001', sets: 2, reps: 12, weight: 20 })] })));
  } finally { view.unmount(); client.clear(); }
});
