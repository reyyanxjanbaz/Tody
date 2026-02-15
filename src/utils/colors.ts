import { StyleSheet, ViewStyle, Platform } from 'react-native';

// ── Font Family ─────────────────────────────────────────────────────────────

export const FontFamily = Platform.select({
  ios: 'CharisSIL',
  android: 'CharisSIL',
  default: 'CharisSIL',
}) as string;

// ── Theme Color Type ────────────────────────────────────────────────────────

export type ThemeColors = {
  black: string;
  white: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray800: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  activeState: string;
  danger: string;
  surfaceDark: string;
  surfaceGlass: string;
  backgroundOffWhite: string;
};

// ── Light Theme ─────────────────────────────────────────────────────────────

export const LightColors = {
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#F5F5F5',
  gray100: '#EEEEEE',
  gray200: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray800: '#424242',

  // Semantic
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#424242',
  textTertiary: '#9E9E9E',
  border: '#E0E0E0',
  borderLight: '#F5F5F5',
  activeState: '#424242',
  danger: '#424242',

  // Dynamic Capsule Theme
  surfaceDark: '#1C1C1E',
  surfaceGlass: 'rgba(255,255,255,0.1)',
  backgroundOffWhite: '#F5F5F7',
} as const;

// ── Dark Theme ──────────────────────────────────────────────────────────────

export const DarkColors = {
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#141414',
  gray100: '#1C1C1C',
  gray200: '#333333',
  gray400: '#7A7A7A',
  gray500: '#9A9A9A',
  gray600: '#B0B0B0',
  gray800: '#D4D4D4',

  // Semantic
  background: '#000000',
  surface: '#141414',
  text: '#F0F0F0',
  textSecondary: '#B8B8B8',
  textTertiary: '#8A8A8A',
  border: '#2A2A2A',
  borderLight: '#1A1A1A',
  activeState: '#D4D4D4',
  danger: '#D4D4D4',

  // Dynamic Capsule Theme
  surfaceDark: '#0A0A0A',
  surfaceGlass: 'rgba(255,255,255,0.05)',
  backgroundOffWhite: '#0A0A0A',
} as const;

// ── Static Colors (backward compat — use useTheme() for dynamic) ────────────

export const Colors = LightColors;

export const Shadows = {
  floating: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  } as ViewStyle,
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  } as ViewStyle,
  subtle: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  } as ViewStyle,
};

export const DarkShadows = {
  floating: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  } as ViewStyle,
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  } as ViewStyle,
  subtle: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.04)',
  } as ViewStyle,
};

export type ThemeShadows = typeof Shadows;

export const BorderRadius = {
  pill: 100,
  card: 14,
  button: 10,
  input: 10,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

export const Typography = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.text,
    fontFamily: FontFamily,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: Colors.text,
    fontFamily: FontFamily,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.gray500,
    fontFamily: FontFamily,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.text,
    fontFamily: FontFamily,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    fontFamily: FontFamily,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    fontFamily: FontFamily,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: Colors.textTertiary,
    fontFamily: FontFamily,
  },
  link: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontFamily: FontFamily,
  },
});


