import Storage from 'expo-sqlite/kv-store';
import { offlineDatabase } from '@/data/local/sqlite-offline-database';
import { SQLiteSessionRepository } from '@/data/local/sqlite-session-repository';
import { SQLiteSyncQueueRepository } from '@/data/local/sqlite-sync-queue-repository';
import { useStore } from 'zustand';
import { LocalSessionRepository } from '../repositories/local-session-repository';
import { createSessionStore, type SessionStore } from './create-session-store';

export const syncQueueRepository = new SQLiteSyncQueueRepository(offlineDatabase);
export const sessionStore = createSessionStore(new SQLiteSessionRepository(offlineDatabase, new LocalSessionRepository({
  getItem: (key) => Storage.getItemSync(key), setItem: (key, value) => Storage.setItemSync(key, value),
})));
export function useSessionStore<T>(selector: (state: SessionStore) => T): T { return useStore(sessionStore, selector); }
