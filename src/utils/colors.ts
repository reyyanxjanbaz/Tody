import { StyleSheet, ViewStyle } from 'react-native';
import { Platform } from 'react-native';

export const FontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';

export const Colors = {
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

// ── Theme Colors Type ──────────────────────────────────────────────────────

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
  // Dark-mode specific
  card: string;
  inputBackground: string;
  navBar: string;
  navBarBorder: string;
  calendarSelected: string;
  calendarSelectedText: string;
  todayDot: string;
  separator: string;
  checkboxBg: string;
  swipeActionBg: string;
  modalBg: string;
  modalOverlay: string;
};

export const LightTheme: ThemeColors = {
  ...Colors,
  card: '#FFFFFF',
  inputBackground: '#F2F2F7',
  navBar: '#FFFFFF',
  navBarBorder: Colors.border,
  calendarSelected: Colors.text,
  calendarSelectedText: '#FFFFFF',
  todayDot: '#000000',
  separator: 'rgba(0,0,0,0.12)',
  checkboxBg: Colors.gray50,
  swipeActionBg: Colors.gray800,
  modalBg: '#FFFFFF',
  modalOverlay: 'rgba(0,0,0,0.4)',
};

export const DarkTheme: ThemeColors = {
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#1C1C1E',
  gray100: '#2C2C2E',
  gray200: '#3A3A3C',
  gray400: '#636366',
  gray500: '#8E8E93',
  gray600: '#AEAEB2',
  gray800: '#D1D1D6',
  background: '#000000',
  surface: '#1C1C1E',
  text: '#F5F5F7',
  textSecondary: '#C7C7CC',
  textTertiary: '#8E8E93',
  border: '#2C2C2E',
  borderLight: '#1C1C1E',
  activeState: '#D1D1D6',
  danger: '#FF6B6B',
  surfaceDark: '#F5F5F7',
  surfaceGlass: 'rgba(255,255,255,0.08)',
  backgroundOffWhite: '#1C1C1E',
  card: '#1C1C1E',
  inputBackground: '#1C1C1E',
  navBar: '#0A0A0A',
  navBarBorder: '#2C2C2E',
  calendarSelected: '#F5F5F7',
  calendarSelectedText: '#000000',
  todayDot: '#F5F5F7',
  separator: 'rgba(255,255,255,0.08)',
  checkboxBg: '#2C2C2E',
  swipeActionBg: '#2C2C2E',
  modalBg: '#1C1C1E',
  modalOverlay: 'rgba(0,0,0,0.7)',
};

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
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: Colors.text,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.gray500,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.text,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: Colors.textTertiary,
  },
  link: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});

export const CommonStyles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
