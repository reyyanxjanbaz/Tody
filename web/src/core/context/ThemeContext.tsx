/**
 * ThemeContext – provides dark/light mode colors throughout the app.
 *
 * Usage:
 *   const { colors, shadows, isDark, toggleTheme } = useTheme();
 *
 * Persists the user's choice to AsyncStorage and defaults to light mode.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  LightColors,
  DarkColors,
  Shadows,
  DarkShadows,
  FontFamily,
  type ThemeColors,
  type ThemeShadows,
} from '../utils/colors';
import { getUserPreferences, saveUserPreferences } from '../utils/storage';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types';

// ── Theme shape ─────────────────────────────────────────────────────────────

interface ThemeContextValue {
  colors: ThemeColors;
  shadows: ThemeShadows;
  isDark: boolean;
  toggleTheme: () => void;
  resetTheme: () => void;
  fontFamily: string;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  shadows: Shadows,
  isDark: false,
  toggleTheme: () => {},
  resetTheme: () => {},
  fontFamily: FontFamily,
});

// ── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // null = preference not yet loaded from storage; avoids rendering with a wrong theme
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference on mount; seed defaults for new users
  useEffect(() => {
    (async () => {
      try {
        const prefs = await getUserPreferences<UserPreferences>();
        if (prefs) {
          setIsDark(prefs.darkMode ?? true);
        } else {
          await saveUserPreferences(DEFAULT_PREFERENCES);
          setIsDark(true);
        }
      } catch {
        setIsDark(true); // safe fallback
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = !(isDark ?? true);
    setIsDark(next);
    const prefs = await getUserPreferences<UserPreferences>();
    await saveUserPreferences({ ...(prefs ?? DEFAULT_PREFERENCES), darkMode: next });
  }, [isDark]);

  // Reset to light mode defaults (called on logout so new users start fresh)
  const resetTheme = useCallback(() => {
    setIsDark(false);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: (isDark ?? true) ? DarkColors : LightColors,
      shadows: (isDark ?? true) ? DarkShadows : Shadows,
      isDark: isDark ?? true,
      toggleTheme,
      resetTheme,
      fontFamily: FontFamily,
    }),
    [isDark, toggleTheme, resetTheme],
  );

  // Reflect the resolved theme onto the document so CSS variables + the browser
  // UI (address bar / status bar) follow it. Replaces RN's <StatusBar>.
  useEffect(() => {
    if (isDark === null) return;
    const dark = isDark ?? true;
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#FFFFFF');
  }, [isDark]);

  // Render nothing until the stored preference is resolved — eliminates theme flash.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
