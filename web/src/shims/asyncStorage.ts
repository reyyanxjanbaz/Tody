/**
 * Web shim for @react-native-async-storage/async-storage.
 *
 * Backed by window.localStorage but exposes the same async Promise-based API,
 * so all ported logic (storage.ts, swipeMemory.ts, patternLearning.ts) and the
 * Supabase auth storage adapter work byte-for-byte unchanged.
 *
 * Wired via a Vite resolve.alias so the original imports resolve here.
 */

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // e.g. storage disabled / private mode
  }
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return ls()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      ls()?.setItem(key, value);
    } catch {
      /* quota / disabled — ignore */
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      ls()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },

  async mergeItem(key: string, value: string): Promise<void> {
    // Shallow JSON merge — matches AsyncStorage semantics closely enough.
    try {
      const store = ls();
      if (!store) return;
      const existing = store.getItem(key);
      if (!existing) {
        store.setItem(key, value);
        return;
      }
      const merged = { ...JSON.parse(existing), ...JSON.parse(value) };
      store.setItem(key, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const store = ls();
    return keys.map((k) => [k, store?.getItem(k) ?? null]);
  },

  async multiSet(pairs: [string, string][]): Promise<void> {
    const store = ls();
    if (!store) return;
    for (const [k, v] of pairs) {
      try {
        store.setItem(k, v);
      } catch {
        /* ignore */
      }
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    const store = ls();
    if (!store) return;
    for (const k of keys) {
      try {
        store.removeItem(k);
      } catch {
        /* ignore */
      }
    }
  },

  async getAllKeys(): Promise<string[]> {
    const store = ls();
    if (!store) return [];
    return Object.keys(store);
  },

  async clear(): Promise<void> {
    try {
      ls()?.clear();
    } catch {
      /* ignore */
    }
  },
};

export default AsyncStorage;
