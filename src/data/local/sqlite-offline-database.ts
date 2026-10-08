import { openDatabaseSync } from 'expo-sqlite';
import { initializeOfflineDatabase, type OfflineDatabase, SQLiteCacheStorage } from './offline-database';

const database = openDatabaseSync('fithub-offline.db');
export const offlineDatabase: OfflineDatabase = {
  exec: (sql) => database.execSync(sql),
  run: (sql, ...values) => { database.runSync(sql, ...values); },
  first: <T>(sql: string, ...values: (string | number | null)[]) => database.getFirstSync<T>(sql, ...values),
  all: <T>(sql: string, ...values: (string | number | null)[]) => database.getAllSync<T>(sql, ...values),
  transaction: (work) => database.withTransactionSync(work),
};
initializeOfflineDatabase(offlineDatabase);
export const offlineCacheStorage = new SQLiteCacheStorage(offlineDatabase);
