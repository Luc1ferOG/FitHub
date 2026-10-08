import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { AchievementsScreen } from '../achievements-screen';
import { useAchievements } from '../../hooks/use-achievements';
jest.mock('../../hooks/use-achievements', () => ({ useAchievements: jest.fn() }));
function query(value: Partial<ReturnType<typeof useAchievements>>) {
  jest.mocked(useAchievements).mockReturnValue({ isRefetching: false, refetch: jest.fn(), ...value } as ReturnType<typeof useAchievements>);
}
it('separates unlocked and locked badges and shows progress', () => {
  const entry = { id: 'one', code: 'FIRST_WORKOUT', title: 'First Workout', description: 'Complete a workout.', icon: 'barbell-outline', category: 'consistency' as const,
    metric: 'workout_count' as const, target: 1, current: 1, unlockedAt: '2026-10-07T10:00:00Z', presentedAt: null, active: true };
  query({ isPending: false, isError: false, data: { entries: [entry, { ...entry, id: 'two', title: '5 Workouts', target: 5, unlockedAt: null }] } });
  render(<AppThemeProvider><AchievementsScreen /></AppThemeProvider>);
  expect(screen.getByText(/Unlocked · 1/)).toBeTruthy(); expect(screen.getByText(/Locked · 1/)).toBeTruthy();
  expect(screen.getByText('1 / 5 workouts')).toBeTruthy();
});
it('offers a retry on failure', () => {
  const refetch = jest.fn(); query({ isPending: false, isError: true, data: undefined, refetch });
  render(<AppThemeProvider><AchievementsScreen /></AppThemeProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Retry' })); expect(refetch).toHaveBeenCalledTimes(1);
});
it('shows loading without rendering stale achievements', () => {
  query({ isPending: true });
  render(<AppThemeProvider><AchievementsScreen /></AppThemeProvider>);
  expect(screen.getByLabelText('Loading achievements')).toBeTruthy();
});
