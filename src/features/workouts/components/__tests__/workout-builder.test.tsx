import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { workout } from '../../testing/fixtures';
import { WorkoutBuilder } from '../workout-builder';

jest.mock('../exercise-picker', () => ({ ExercisePicker: () => null }));
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ['enabled', 'activateAfterLongPress', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) chain[method] = jest.fn(() => chain);
  return { Gesture: { Pan: () => chain }, GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

describe('workout builder', () => {
  it('edits details and exercise configuration before saving', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AppThemeProvider><WorkoutBuilder initial={workout} busy={false} error={null} onSave={onSave} /></AppThemeProvider>);
    fireEvent.changeText(screen.getByLabelText('Workout name'), 'Updated strength');
    fireEvent.changeText(screen.getByLabelText('Target sets'), '4');
    fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated strength', exercises: [expect.objectContaining({ sets: 4, reps: 10 })] })));
  });
  it('requires a name and at least one exercise without submitting', async () => {
    const onSave = jest.fn();
    render(<AppThemeProvider><WorkoutBuilder busy={false} error={null} onSave={onSave} /></AppThemeProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    await screen.findByText('Workout name is required');
    expect(onSave).not.toHaveBeenCalled();
  });
  it('reorders duplicate occurrences and preserves each configuration', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const exercise = workout.exercises[0];
    if (!exercise) throw new Error('Missing fixture');
    render(<AppThemeProvider><WorkoutBuilder initial={{ ...workout, exercises: [exercise, { ...exercise, id: 'entry-2', exerciseName: 'Second squat', sets: 5 }] }} busy={false} error={null} onSave={onSave} /></AppThemeProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Move Back Squat down' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ exercises: [expect.objectContaining({ sets: 5 }), expect.objectContaining({ sets: 3 })] })));
  });
});
