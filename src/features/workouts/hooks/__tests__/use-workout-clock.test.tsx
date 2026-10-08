import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useWorkoutClock } from '../use-workout-clock';
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]) }));

it('stops display ticks in background and restores absolute time on resume', () => {
  jest.useFakeTimers(); jest.setSystemTime(0);
  jest.replaceProperty(AppState, 'currentState', 'active');
  let change: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => { change = listener; return { remove }; });
  const hook = renderHook(() => useWorkoutClock());
  try {
    act(() => { jest.advanceTimersByTime(1000); }); expect(hook.result.current).toBe(1000);
    act(() => { change?.('background'); jest.advanceTimersByTime(5000); }); expect(hook.result.current).toBe(1000);
    act(() => { change?.('active'); }); expect(hook.result.current).toBe(6000);
    hook.unmount(); expect(remove).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.restoreAllMocks(); jest.useRealTimers(); }
});
