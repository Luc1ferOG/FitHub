import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '@/theme';
import { UserSearchScreen } from '../user-search-screen';
import { socialService } from '../../services/social-dependencies';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('../../services/social-dependencies', () => ({ socialService: { search: jest.fn() } }));
it('debounces search and opens resulting public profile', async () => {
  jest.useFakeTimers(); const client = new QueryClient({ defaultOptions: { queries: { retry:false } } });
  jest.mocked(socialService.search).mockResolvedValue({ items:[{ id:'target',username:'alice',displayName:'Alice',avatarUrl:null,bio:null,experienceLevel:'beginner' }],nextOffset:null });
  const view = render(<QueryClientProvider client={client}><AppThemeProvider><UserSearchScreen /></AppThemeProvider></QueryClientProvider>);
  try {
    fireEvent.changeText(screen.getByLabelText('Search username or display name'),'a');
    fireEvent.changeText(screen.getByLabelText('Search username or display name'),'alice');
    expect(socialService.search).not.toHaveBeenCalled(); await act(async () => { jest.advanceTimersByTime(350); });
    await waitFor(() => expect(socialService.search).toHaveBeenCalledTimes(1));
    fireEvent.press(await screen.findByRole('button',{ name:/View Alice/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname:'/user/[id]',params:{ id:'target' } });
  } finally { view.unmount(); client.clear(); jest.useRealTimers(); }
});
