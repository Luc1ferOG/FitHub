import { offlineCacheStorage } from './sqlite-offline-database';
import { SQLiteOfflineIdentityRepository } from './sqlite-offline-identity-repository';

export const offlineIdentityRepository = new SQLiteOfflineIdentityRepository(offlineCacheStorage);
