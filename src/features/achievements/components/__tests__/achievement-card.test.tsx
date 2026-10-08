import { render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import type { Achievement } from '../../types/achievement';
import { AchievementCard } from '../achievement-card';
const badge: Achievement = { id: 'badge', code: 'VOLUME_100000', title: 'Marathon Lifter', description: 'Lift 100,000 kg.', icon: 'fitness-outline',
  category: 'volume', metric: 'total_volume', target: 100000, current: 72500, unlockedAt: null, presentedAt: null, active: true };
it('renders a locked milestone with numeric progress and accessible content', () => {
  render(<AppThemeProvider><AchievementCard achievement={badge} /></AppThemeProvider>);
  expect(screen.getByText('72,500 / 100,000 kg')).toBeTruthy();
  expect(screen.getByLabelText(/Marathon Lifter.*Locked/)).toBeTruthy();
});
it('renders an earned badge with date instead of locked progress', () => {
  render(<AppThemeProvider><AchievementCard achievement={{ ...badge, unlockedAt: '2026-10-07T10:00:00Z' }} /></AppThemeProvider>);
  expect(screen.getByLabelText(/Marathon Lifter.*Unlocked/)).toBeTruthy();
  expect(screen.queryByText('72,500 / 100,000 kg')).toBeNull();
});
