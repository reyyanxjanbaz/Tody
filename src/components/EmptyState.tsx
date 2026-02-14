import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { AnimatedPressable } from './ui';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Feature 8: Contextual Empty States
 * 
 * Centered layout, 48x48pt icon (black line art), 16pt black text message,
 * 14pt gray suggestion below, action button underneath (black text).
 * Context-aware: never leaves user confused about why something is empty.
 */
export const EmptyState = memo(function EmptyState({
  title,
  subtitle,
  icon,
  iconColor,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View
      entering={FadeIn.duration(350)}
      style={styles.container}>
      {icon && (
        <Animated.View
          entering={FadeInDown.delay(80).duration(300)}
          style={styles.iconContainer}>
          <Icon name={icon} size={48} color={iconColor || colors.gray400} />
        </Animated.View>
      )}
      <Animated.Text
        entering={FadeInDown.delay(140).duration(300)}
        style={styles.title}>
        {title}
      </Animated.Text>
      {subtitle ? (
        <Animated.Text
          entering={FadeInDown.delay(200).duration(300)}
          style={styles.subtitle}>
          {subtitle}
        </Animated.Text>
      ) : null}
      {actionLabel && onAction ? (
        <Animated.View
          entering={FadeInDown.delay(260).duration(300)}>
          <AnimatedPressable onPress={onAction} hapticStyle="light">
            <View style={styles.actionButton}>
              <Text style={styles.actionText}>{actionLabel}</Text>
            </View>
          </AnimatedPressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingTop: 80,
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.body,
    color: c.gray500,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.caption,
    color: c.gray400,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  actionButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: c.text,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.white,
    fontFamily: FontFamily,
  },
});
