import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import type { FitnessChallenge } from '../../types/fitness-challenge';
import { ChallengeCard } from '../challenge-card';

const challenge: FitnessChallenge = { id: '99000000-0000-0000-0000-000000000003', creatorId: 'owner', title: 'Six workouts',
  description: '', metric: 'workout_count', target: 6, startDate: '2026-10-01', endDate: '2026-10-31',
  visibility: 'public', status: 'active', exerciseId: null };
it('announces the target/type and opens the selected challenge', () => {
  const open = jest.fn(); render(<AppThemeProvider><ChallengeCard challenge={challenge} onPress={open} /></AppThemeProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Six workouts. Workout Count, target 6 workouts. active' }));
  expect(open).toHaveBeenCalledWith(challenge.id);
});
it('displays stored seconds as minutes and distinguishes invitation-only challenges', () => {
  render(<AppThemeProvider><ChallengeCard challenge={{ ...challenge, metric: 'duration_seconds', target: 300, visibility: 'private' }} onPress={jest.fn()} /></AppThemeProvider>);
  expect(screen.getByRole('button', { name: /target 5 min/ })).toBeTruthy();
  expect(screen.getByText(/Invite only/)).toBeTruthy();
});
