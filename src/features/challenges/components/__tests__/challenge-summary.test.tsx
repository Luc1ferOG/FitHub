import { fireEvent,render,screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AppThemeProvider } from '@/theme';
import { ChallengeSummary } from '../challenge-summary';
import type { ChallengeDetails } from '../../types/fitness-challenge';

const mockMutate = jest.fn();
jest.mock('expo-router',() => ({ ...jest.requireActual('expo-router'), useRouter:() => ({ push:jest.fn() }) }));
jest.mock('@/features/auth/context/auth-context',() => ({ useAuth:() => ({ user:{ id:'owner' } }) }));
jest.mock('../../hooks/use-challenges',() => ({ useChallengeAction:() => ({ mutate:mockMutate,isPending:false,error:null }) }));
jest.mock('../invite-friends-picker',() => ({ InviteFriendsPicker:() => null }));
const details:ChallengeDetails = { challenge:{ id:'challenge',creatorId:'creator',title:'Monthly workouts',description:'Stay consistent',metric:'workout_count',target:12,startDate:'2026-10-01',endDate:'2099-10-31',visibility:'public',status:'active',exerciseId:null },creator:{ id:'creator',displayName:'Creator',username:'creator' },exerciseName:null,participantCount:5,membership:null,invited:false,leaderboard:[],nextOffset:null };
describe('challenge participation controls',() => {
  beforeEach(() => jest.clearAllMocks());
  it('joins public challenges without a manual progress input',() => {
    render(<AppThemeProvider><ChallengeSummary details={details} realtime="connected" /></AppThemeProvider>);
    fireEvent.press(screen.getByRole('button',{ name:'Join challenge' })); expect(mockMutate).toHaveBeenCalledWith({ action:'join' });
    expect(screen.getByText('Live updates connected')).toBeTruthy();
  });
  it('accepts an invitation instead of offering public join',() => {
    render(<AppThemeProvider><ChallengeSummary details={{ ...details,invited:true,challenge:{ ...details.challenge,visibility:'private' } }} realtime="connected" /></AppThemeProvider>);
    expect(screen.queryByRole('button',{ name:'Join challenge' })).toBeNull(); fireEvent.press(screen.getByRole('button',{ name:'Accept invite' })); expect(mockMutate).toHaveBeenCalledWith({ action:'accept' });
  });
  it('shows score and position and confirms leave',() => {
    const alert = jest.spyOn(Alert,'alert').mockImplementation(() => undefined);
    render(<AppThemeProvider><ChallengeSummary details={{ ...details,membership:{ userId:'owner',currentValue:6,rank:2,completed:false,leftAt:null } }} realtime="disconnected" /></AppThemeProvider>);
    expect(screen.getByText('5 participants · Your position: #2')).toBeTruthy(); expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ min:0,max:100,now:50,text:'50 percent complete' });
    fireEvent.press(screen.getByRole('button',{ name:'Leave challenge' })); expect(alert).toHaveBeenCalled(); expect(mockMutate).not.toHaveBeenCalled(); alert.mockRestore();
  });
});
