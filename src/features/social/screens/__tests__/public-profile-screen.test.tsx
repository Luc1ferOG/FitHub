import { render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { PublicProfileScreen } from '../public-profile-screen';
import { usePublicProfile } from '../../hooks/use-social';

jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useLocalSearchParams: () => ({ id: '93000000-0000-0000-0000-000000000001' }) }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../../components/friend-actions', () => ({ FriendActions: () => null }));
jest.mock('../../hooks/use-social', () => ({ usePublicProfile: jest.fn() }));
it('renders public identity, selected counts and earned achievements', () => {
  jest.mocked(usePublicProfile).mockReturnValue({ isPending: false, error: null, data: { id:'target',username:'alice',displayName:'Alice',avatarUrl:null,bio:'Loves lifting',experienceLevel:'intermediate',publicWorkoutCount:3,achievementCount:1,achievements:[{ code:'first',title:'First Workout',icon:'trophy',unlockedAt:'2026-10-07T10:00:00Z' }] } } as unknown as ReturnType<typeof usePublicProfile>);
  render(<AppThemeProvider><PublicProfileScreen /></AppThemeProvider>);
  expect(screen.getByRole('header',{ name:'Alice' })).toBeTruthy();
  expect(screen.getByText('Loves lifting')).toBeTruthy(); expect(screen.getByText('@alice · intermediate')).toBeTruthy();
  expect(screen.getByText('3 public workout templates · 1 achievements')).toBeTruthy();
  expect(screen.getByLabelText('Achievement: First Workout')).toBeTruthy();
});
it('offers retry without exposing raw transport errors', () => {
  jest.mocked(usePublicProfile).mockReturnValue({ isPending:false,error:new Error('Could not connect to FitHub.'),data:undefined,refetch:jest.fn() } as unknown as ReturnType<typeof usePublicProfile>);
  render(<AppThemeProvider><PublicProfileScreen /></AppThemeProvider>);
  expect(screen.getByRole('button',{ name:'Retry profile' })).toBeTruthy();
});
