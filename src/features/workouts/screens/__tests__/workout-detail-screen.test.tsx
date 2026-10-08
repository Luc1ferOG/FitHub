import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { workout } from '../../testing/fixtures';
import { WorkoutDetailScreen } from '../workout-detail-screen';

const mockMutate = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBegin = jest.fn(() => 'session-id');
jest.mock('../../hooks/use-workout-session', () => ({ useBeginWorkout: () => mockBegin }));
jest.mock('../../hooks/use-session-history', () => ({ useSessionHistory: () => ({ data: [] }) }));
jest.mock('../../state/session-store', () => ({ useSessionStore: (selector: (state: { hydrated: boolean }) => unknown) => selector({ hydrated: true }) }));
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), Stack: { Screen: () => null }, useLocalSearchParams: () => ({ workoutId: '30000000-0000-0000-0000-000000000001' }), useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('@/store/app-store', () => ({ useAppStore: (select: (state: { isOffline: boolean }) => unknown) => select({ isOffline: false }) }));
jest.mock('../../hooks/use-workouts', () => ({
  useWorkout: () => ({ data: jest.requireActual('../../testing/fixtures').workout, isPending: false, isError: false }),
  useWorkoutMutation: () => ({ mutateAsync: mockMutate, isBusy: false, error: null, reset: jest.fn() }),
}));
describe('workout detail actions', () => {
  beforeEach(() => jest.clearAllMocks());
  it('starts a local session and opens the active workout route', () => {
    render(<AppThemeProvider><WorkoutDetailScreen /></AppThemeProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Start Workout' }));
    expect(mockBegin).toHaveBeenCalledWith(workout);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/workouts/active/[sessionId]', params: { sessionId: 'session-id' } });
  });
  it('requires confirmation before deleting and navigates to the workout list', async () => {
    mockMutate.mockResolvedValue(null);
    render(<AppThemeProvider><WorkoutDetailScreen /></AppThemeProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    expect(mockMutate).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Delete workout permanently' }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledWith({ type: 'delete', id: workout.id, updatedAt: workout.updatedAt }));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/workouts');
  });
  it('opens the edit route and duplicates into a new detail route', async () => {
    mockMutate.mockResolvedValue({ ...workout, id: 'copy' });
    render(<AppThemeProvider><WorkoutDetailScreen /></AppThemeProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Edit workout' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/workouts/edit/[workoutId]', params: { workoutId: workout.id } });
    fireEvent.press(screen.getByRole('button', { name: 'Duplicate workout' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/workouts/[workoutId]', params: { workoutId: 'copy', saved: '1' } }));
  });
});
