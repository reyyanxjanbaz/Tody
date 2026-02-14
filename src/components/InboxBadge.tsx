import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography } from '../utils/colors';
import { useInbox } from '../context/InboxContext';
import { useTheme } from '../context/ThemeContext';

interface InboxBadgeProps {
  onPress: () => void;
}

export const InboxBadge = memo(function InboxBadge({ onPress }: InboxBadgeProps) {
  const { inboxCount } = useInbox();
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="document-text-outline" size={24} color={colors.textTertiary} />
        {inboxCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.text, borderColor: colors.background }]}>
            <Text style={[styles.badgeText, { color: colors.background }]}>
              {inboxCount > 99 ? '99+' : inboxCount}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color: colors.textTertiary }]}>Memos</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: 2,
  },
  iconContainer: {
    position: 'relative',
    height: 20,
    width: 26,
    alignItems: 'center',
  },
  label: {
    ...Typography.small,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
