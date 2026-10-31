import { createClient } from '@supabase/supabase-js';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import type { Database } from '@shared/database.types.ts';

import { createChunkedStorage, type KeyValueStore } from './chunked-storage.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url) throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set');
if (!publishableKey) throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');

const STORAGE_KEY = 'saebom-auth';
const KEYCHAIN_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const keychain: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS),
  removeItem: (key) => SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS),
};

const chunkedKeychain = createChunkedStorage(keychain);

// iOS keeps Keychain items after the app is deleted, so a fresh install starts by dropping them.
// The marker lives in the app's documents, which iOS does delete with the app.
async function clearStaleKeychain(): Promise<void> {
  const marker = new File(Paths.document, 'keychain-cleared');
  if (marker.exists) return;
  await chunkedKeychain.removeItem(STORAGE_KEY);
  await chunkedKeychain.removeItem(`${STORAGE_KEY}-code-verifier`);
  marker.create();
}

const ready = clearStaleKeychain();
// Each storage call awaits `ready` and sees the failure; this only silences the unhandled rejection.
ready.catch(() => {});

const storage: KeyValueStore = {
  getItem: async (key) => {
    await ready;
    return chunkedKeychain.getItem(key);
  },
  setItem: async (key, value) => {
    await ready;
    return chunkedKeychain.setItem(key, value);
  },
  removeItem: async (key) => {
    await ready;
    return chunkedKeychain.removeItem(key);
  },
};

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    storage,
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function readStoredSession(): Promise<string | null> {
  return storage.getItem(STORAGE_KEY);
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
