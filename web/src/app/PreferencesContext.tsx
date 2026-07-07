import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo, useRef,
} from 'react';
import { UserPreferences, DEFAULT_PREFERENCES } from '../core/types';
import { getUserPreferences, saveUserPreferences } from '../core/utils/storage';
import { api } from '../core/lib/api';

/**
 * Web-only preferences that are NOT part of the shared `UserPreferences` type
 * or the Supabase `profiles` table (so `core/types` stays byte-identical to
 * native). Persisted locally only, under their own storage key.
 */
export interface WebPreferences {
  reduceMotion: 'system' | 'on' | 'off';
  textSize: 'sm' | 'md' | 'lg';
  quietHoursStart: string | null; // 'HH:MM' or null (disabled)
  quietHoursEnd: string | null;
}

export const DEFAULT_WEB_PREFERENCES: WebPreferences = {
  reduceMotion: 'system',
  textSize: 'md',
  quietHoursStart: null,
  quietHoursEnd: null,
};

const WEB_PREFS_KEY = 'tody:webprefs';

interface PreferencesContextValue {
  prefs: UserPreferences;          // dateFormat / timeFormat / weekStartsOn / darkMode
  webPrefs: WebPreferences;
  loaded: boolean;
  setPref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  setWebPref: <K extends keyof WebPreferences>(key: K, value: WebPreferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function loadWebPrefs(): WebPreferences {
  try {
    const raw = localStorage.getItem(WEB_PREFS_KEY);
    return raw ? { ...DEFAULT_WEB_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_WEB_PREFERENCES;
  } catch {
    return DEFAULT_WEB_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [webPrefs, setWebPrefs] = useState<WebPreferences>(DEFAULT_WEB_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  // Skip the very first profile PATCH (nothing changed on mount).
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const stored = await getUserPreferences<UserPreferences>();
      if (stored) setPrefs({ ...DEFAULT_PREFERENCES, ...stored });
      setWebPrefs(loadWebPrefs());
      setLoaded(true);
    })();
  }, []);

  const setPref = useCallback<PreferencesContextValue['setPref']>((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      // Read-merge-write so we never clobber darkMode (owned by ThemeContext)
      // or fields another writer changed.
      (async () => {
        const onDisk = (await getUserPreferences<UserPreferences>()) ?? DEFAULT_PREFERENCES;
        await saveUserPreferences({ ...onDisk, [key]: value });
      })();
      if (hydrated.current) {
        api.patch('/profile', {
          date_format: next.dateFormat,
          time_format: next.timeFormat,
          week_starts_on: next.weekStartsOn,
        }).catch(() => {});
      }
      hydrated.current = true;
      return next;
    });
  }, []);

  const setWebPref = useCallback<PreferencesContextValue['setWebPref']>((key, value) => {
    setWebPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(WEB_PREFS_KEY, JSON.stringify(next));
      } catch { /* quota / private mode */ }
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ prefs, webPrefs, loaded, setPref, setWebPref }),
    [prefs, webPrefs, loaded, setPref, setWebPref],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
