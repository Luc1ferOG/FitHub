import { render,screen } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { LeaderboardUserRow } from '../leaderboard-user-row';
import { LeaderboardPodium } from '../leaderboard-podium';
import type { RankedUser } from '../../types/leaderboard';
jest.mock('expo-image',()=>({ Image:'Image' }));
const mark:RankedUser = { userId:'mark',displayName:'Mark',username:'mark',avatarUrl:'https://example.test/avatar.png',value:13,rank:2 };
it('renders goal progress, percentage, avatar and a descriptive label',()=> {
  render(<AppThemeProvider><LeaderboardUserRow entry={mark} metric="workout_count" target={20} currentUserId="me" /></AppThemeProvider>);
  expect(screen.getByLabelText('Rank 2, Mark, 13 out of 20 workouts completed, 65 percent complete.')).toBeTruthy();
  expect(screen.getByText('13 / 20 workouts')).toBeTruthy(); expect(screen.getByText('65% completed')).toBeTruthy();
});
it('marks the current user with text and a border, not color alone',()=> {
  render(<AppThemeProvider><LeaderboardUserRow entry={mark} metric="workout_count" target={20} currentUserId="mark" /></AppThemeProvider>);
  expect(screen.getByText('Mark (You)')).toBeTruthy(); expect(screen.getByLabelText(/Rank 2, Mark, you/)).toHaveStyle({ borderWidth:2 });
});
it('preserves tied podium ranks and never pretends the second tied entry is rank two',()=> {
  const entries = [{ ...mark,userId:'a',displayName:'Alex',rank:1,value:15 },{ ...mark,userId:'b',rank:1,value:15 },{ ...mark,userId:'c',displayName:'Sarah',rank:2,value:11 }];
  render(<AppThemeProvider><LeaderboardPodium entries={entries} metric="workout_count" target={20} currentUserId="a" /></AppThemeProvider>);
  expect(screen.getAllByText('#1')).toHaveLength(2); expect(screen.queryByText('#3')).toBeNull(); expect(screen.getByLabelText(/Podium. Rank 2, Sarah/)).toBeTruthy();
});
