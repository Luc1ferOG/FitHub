import { create } from 'zustand';
import { offlineCacheStorage } from '@/data/local/sqlite-offline-database';
import { parseDestination } from '@/services/navigation/destinations';
import { parseStoredIntent, type NavigationIntent } from '@/services/navigation/navigation-intent';

const KEY = 'pending-navigation-intent';
type IntentState = { intent: NavigationIntent | null; hydrated: boolean; restore: () => void;
  capture: (path: string, recipientId?: string | null) => void; clear: () => void };
export const useNavigationIntentStore = create<IntentState>((set) => ({
  intent: null, hydrated: false,
  restore: () => {
    try {
      const raw = offlineCacheStorage.getItem(KEY);
      set({ intent: raw ? parseStoredIntent(JSON.parse(raw) as unknown, Date.now()) : null, hydrated: true });
    } catch { set({ intent: null, hydrated: true }); }
  },
  capture: (input, recipientId = null) => {
    const path = parseDestination(input);
    if (!path) return;
    const intent = parseStoredIntent({ path, recipientId, createdAt: Date.now() }, Date.now());
    if (!intent) return;
    try { offlineCacheStorage.setItem(KEY, JSON.stringify(intent)); } catch { /* Retain in memory if disk is full. */ }
    set({ intent });
  },
  clear: () => {
    try { offlineCacheStorage.removeItem(KEY); } catch { /* TTL limits any stale disk copy. */ }
    set({ intent: null });
  },
}));
