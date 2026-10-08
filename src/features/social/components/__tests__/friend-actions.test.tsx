import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AppThemeProvider } from '@/theme';
import { FriendActions } from '../friend-actions';
import { useFriendMutation, useFriendRelation } from '../../hooks/use-social';
import type { Friendship } from '../../types/friendship';

jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('../../hooks/use-social', () => ({ useFriendMutation: jest.fn(), useFriendRelation: jest.fn() }));
const mutate = jest.fn();
const relation: Friendship = { id: 'request', requesterId: 'owner', addresseeId: 'target', status: 'pending', createdAt: 'now' };
function setup(data: Friendship | null, target = 'target', pending = false) {
  jest.mocked(useFriendRelation).mockReturnValue({ data, isPending: false, isError: false } as unknown as ReturnType<typeof useFriendRelation>);
  jest.mocked(useFriendMutation).mockReturnValue({ mutate, isPending: pending, error: null } as unknown as ReturnType<typeof useFriendMutation>);
  return render(<AppThemeProvider><FriendActions target={target} /></AppThemeProvider>);
}
describe('friend actions', () => {
  beforeEach(() => jest.clearAllMocks());
  it('offers Add Friend', () => { setup(null); fireEvent.press(screen.getByRole('button',{ name:'Add Friend' })); expect(mutate).toHaveBeenCalledWith({ action:'send',relation:null }); });
  it('outgoing request cannot be sent again', () => { setup(relation); expect(screen.getByRole('button',{ name:'Request Sent' })).toBeDisabled(); fireEvent.press(screen.getByRole('button',{ name:'Cancel Request' })); expect(mutate).toHaveBeenCalledWith({ action:'cancel',relation }); });
  it.each(['Accept','Reject'])('recipient can %s', (label) => { const incoming = { ...relation,requesterId:'target',addresseeId:'owner' }; setup(incoming); fireEvent.press(screen.getByRole('button',{ name:label })); expect(mutate).toHaveBeenCalledWith({ action:label.toLowerCase(),relation:incoming }); });
  it('requires removal confirmation', () => { const alert = jest.spyOn(Alert,'alert').mockImplementation(() => undefined); setup({ ...relation,status:'accepted' }); fireEvent.press(screen.getByRole('button',{ name:'Remove Friend' })); expect(alert).toHaveBeenCalled(); expect(mutate).not.toHaveBeenCalled(); alert.mockRestore(); });
  it('never shows self request controls', () => { setup(null,'owner'); expect(screen.queryByRole('button')).toBeNull(); });
  it('disables submit during writes', () => { setup(null,'target',true); expect(screen.getByRole('button',{ name:'Add Friend' })).toBeDisabled(); });
});
