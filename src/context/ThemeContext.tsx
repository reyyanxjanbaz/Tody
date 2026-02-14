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
import { StatusBar } from 'react-native';
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
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference on mount; seed defaults for new users
  useEffect(() => {
    (async () => {
      const prefs = await getUserPreferences<UserPreferences>();
      if (prefs) {
        if (prefs.darkMode) {
          setIsDark(true);
        }
      } else {
        // First launch – persist default preferences (light mode, etc.)
        await saveUserPreferences(DEFAULT_PREFERENCES);
      }
      setLoaded(true);
    })();
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = !isDark;
    setIsDark(next);
    // Persist to storage
    const prefs = await getUserPreferences<UserPreferences>();
    await saveUserPreferences({ ...(prefs ?? DEFAULT_PREFERENCES), darkMode: next });
  }, [isDark]);

  // Reset to light mode defaults (called on logout so new users start fresh)
  const resetTheme = useCallback(() => {
    setIsDark(false);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? DarkColors : LightColors,
      shadows: isDark ? DarkShadows : Shadows,
      isDark,
      toggleTheme,
      resetTheme,
      fontFamily: FontFamily,
    }),
    [isDark, toggleTheme, resetTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#000000' : '#FFFFFF'}
      />
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
