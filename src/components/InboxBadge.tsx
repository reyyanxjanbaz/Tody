import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { useInbox } from '../context/InboxContext';

interface InboxBadgeProps {
  onPress: () => void;
}

export const InboxBadge = memo(function InboxBadge({ onPress }: InboxBadgeProps) {
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { inboxCount } = useInbox();

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="document-text-outline" size={24} color={colors.textTertiary} />
        {inboxCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {inboxCount > 99 ? '99+' : inboxCount}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.label}>Memos</Text>
    </Pressable>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
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
    color: c.textTertiary,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: c.text,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: c.background,
  },
  badgeText: {
    color: c.white,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
    fontFamily: FontFamily,
  },
});
