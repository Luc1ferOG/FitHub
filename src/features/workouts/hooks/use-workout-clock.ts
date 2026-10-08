import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Display-only clock. Absolute persisted deadlines still own workout/rest time.
export function useWorkoutClock() {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const update = (state: AppStateStatus) => {
      if (interval) clearInterval(interval);
      interval = null;
      if (state === 'active') {
        setNow(Date.now());
        interval = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    if (AppState.currentState) update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { if (interval) clearInterval(interval); subscription.remove(); };
  }, []));
  return now;
}
