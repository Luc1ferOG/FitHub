import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { AppThemeProvider } from '@/theme';

import { ExerciseVideo } from '../exercise-video';

let mockStatus = 'readyToPlay';
let mockIsFocused = true;
let mockIsPlaying = false;
const mockPlayer = { play: jest.fn(), pause: jest.fn(), loop: false, playing: false, status: 'readyToPlay' };
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'), useIsFocused: () => mockIsFocused,
}));
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  useEvent: (_player: unknown, event: string) => event === 'statusChange' ? { status: mockStatus } : { isPlaying: mockIsPlaying },
}));
jest.mock('expo-video', () => ({
  useVideoPlayer: (_url: string, setup: (player: typeof mockPlayer) => void) => { setup(mockPlayer); return mockPlayer; },
  VideoView: 'VideoView',
}));

describe('ExerciseVideo', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockStatus = 'readyToPlay'; mockIsFocused = true; mockIsPlaying = false;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  });
  afterEach(() => jest.restoreAllMocks());

  it('does not autoplay and provides an accessible play control', () => {
    render(<AppThemeProvider><ExerciseVideo url="https://example.com/squat.mp4" name="Squat" /></AppThemeProvider>);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Play tutorial' }));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('shows a failed-video state with a retry action', () => {
    mockStatus = 'error';
    render(<AppThemeProvider><ExerciseVideo url="https://example.com/squat.mp4" name="Squat" /></AppThemeProvider>);
    expect(screen.getByText('Video could not be loaded')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry video' })).toBeTruthy();
  });

  it('pauses an already playing tutorial', () => {
    mockIsPlaying = true;
    render(<AppThemeProvider><ExerciseVideo url="https://example.com/squat.mp4" name="Squat" /></AppThemeProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Pause tutorial' }));
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('announces loading and disables playback until ready', () => {
    mockStatus = 'loading';
    render(<AppThemeProvider><ExerciseVideo url="https://example.com/squat.mp4" name="Squat" /></AppThemeProvider>);
    expect(screen.getByRole('progressbar', { name: 'Loading tutorial' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play tutorial' }).props['accessibilityState'].disabled).toBe(true);
  });

  it('pauses on background and removes the app-state listener on unmount', () => {
    const remove = jest.fn();
    const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      handler('background');
      return { remove };
    });
    const view = render(<AppThemeProvider><ExerciseVideo url="https://example.com/squat.mp4" name="Squat" /></AppThemeProvider>);
    expect(mockPlayer.pause).toHaveBeenCalled();
    view.unmount();
    expect(remove).toHaveBeenCalled();
    listener.mockRestore();
  });

  it('removes the video view when the detail screen loses focus', () => {
    const view = render(<AppThemeProvider><ExerciseVideo url="https://example.com/squat.mp4" name="Squat" /></AppThemeProvider>);
    expect(screen.getByLabelText('Squat form tutorial video')).toBeTruthy();
    mockIsFocused = false;
    view.rerender(<AppThemeProvider><ExerciseVideo url="https://example.com/squat.mp4" name="Squat" /></AppThemeProvider>);
    expect(screen.queryByLabelText('Squat form tutorial video')).toBeNull();
  });
});
