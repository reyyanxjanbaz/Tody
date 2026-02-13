import { StyleSheet } from 'react-native';

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
