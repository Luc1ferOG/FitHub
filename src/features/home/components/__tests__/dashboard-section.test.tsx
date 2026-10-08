import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import type { HomeDashboard } from '../../types/dashboard';
import { DashboardSection } from '../dashboard-section';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: mockPush }) }));
const data: HomeDashboard = { generatedAt: '2026-10-07T10:00:00Z', localDay: '2026-10-07', profile: { displayName: 'Alex', units: 'metric' }, today: { workouts: 1 }, week: { workouts: 3, durationSeconds: 7200, volumeKg: 10000 }, activeChallengeCount: 2,
  templates: [{ id: '91000000-0000-0000-0000-000000000001', name: 'Upper body', estimated_duration: 2700, updated_at: '2026-10-07T10:00:00Z' }], challenges: [], latestAchievement: null, activity: [] };
beforeEach(() => mockPush.mockClear());
it('shows weekly totals without requesting independent widget data', () => {
  render(<AppThemeProvider><DashboardSection section="week" dashboard={data} now={new Date()} activeName={null} /></AppThemeProvider>);
  expect(screen.getByText('3 workouts')).toBeTruthy(); expect(screen.getByText('120 minutes training')).toBeTruthy();
});
it('routes quick start to template selection and a recent template to its detail', () => {
  render(<AppThemeProvider><DashboardSection section="quick" dashboard={data} now={new Date()} activeName={null} /></AppThemeProvider>);
  fireEvent.press(screen.getByText('Start Workout')); expect(mockPush).toHaveBeenCalledWith('/(tabs)/workouts');
  fireEvent.press(screen.getByText('Upper body · 45 min')); expect(mockPush).toHaveBeenCalledWith({ pathname: '/workouts/[workoutId]', params: { workoutId: data.templates[0]?.id } });
});
it('shows active workout state over the completed-workout prompt', () => {
  render(<AppThemeProvider><DashboardSection section="today" dashboard={data} now={new Date()} activeName="Upper body" /></AppThemeProvider>);
  expect(screen.getByText('Upper body in progress')).toBeTruthy();
});
