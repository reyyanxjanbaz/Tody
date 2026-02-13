import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography } from '../utils/colors';

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
  return (
    <View style={styles.container}>
      {icon && (
        <View style={styles.iconContainer}>
          <Icon name={icon} size={48} color={iconColor || Colors.gray400} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
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
    color: Colors.gray500,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  actionButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.black,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
});
