import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SecureSessionStorage, type AsyncKeyValueStorage } from '@/data/local/secure-session-storage';

const encryptedStorage: AsyncKeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
// SecureStore is native-only. Web keeps the SDK browser adapter's storage threat
// model; do not describe a web preview as encrypted credential storage.
export const authStorage = Platform.OS === 'web' ? AsyncStorage
  : new SecureSessionStorage(encryptedStorage, AsyncStorage, () => Crypto.randomUUID());
