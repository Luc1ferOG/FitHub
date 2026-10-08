import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/constants/app';
import type { ThemePreference } from '@/types/navigation';

type AppState = {
  themePreference: ThemePreference;
  isOffline: boolean;
  hasHydrated: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  setIsOffline: (isOffline: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      // Unknown connectivity is treated as offline until NetInfo confirms it.
      isOffline: true,
      hasHydrated: false,
      setThemePreference: (themePreference) => set({ themePreference }),
      setIsOffline: (isOffline) => set({ isOffline }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: STORAGE_KEYS.appStore,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ themePreference }) => ({ themePreference }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
