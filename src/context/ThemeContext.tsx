import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LightTheme,
  DarkTheme,
  Shadows,
  type ThemeColors,
} from '../utils/colors';

// ── Types ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  shadows: typeof Shadows;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightTheme,
  isDark: false,
  shadows: Shadows,
  toggleDarkMode: () => {},
  setDarkMode: () => {},
});

const DARK_MODE_KEY = '@tody_dark_mode';

// ── Provider ───────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference
  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((val) => {
      if (val !== null) {
        setIsDark(val === 'true');
      } else {
        setIsDark(systemScheme === 'dark');
      }
      setLoaded(true);
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(DARK_MODE_KEY, String(next));
      return next;
    });
  }, []);

  const setDarkModeExplicit = useCallback((enabled: boolean) => {
    setIsDark(enabled);
    AsyncStorage.setItem(DARK_MODE_KEY, String(enabled));
  }, []);

  const colors = useMemo(() => (isDark ? DarkTheme : LightTheme), [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      isDark,
      shadows: Shadows,
      toggleDarkMode,
      setDarkMode: setDarkModeExplicit,
    }),
    [colors, isDark, toggleDarkMode, setDarkModeExplicit],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
