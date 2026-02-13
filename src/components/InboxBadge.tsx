import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../utils/colors';
import { useInbox } from '../context/InboxContext';

interface InboxBadgeProps {
  onPress: () => void;
}

export const InboxBadge = memo(function InboxBadge({ onPress }: InboxBadgeProps) {
  const { inboxCount } = useInbox();

  if (inboxCount === 0) return null;

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.container}>
      <Text style={styles.label}>Inbox</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {inboxCount > 99 ? '99+' : inboxCount}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 14,
  },
});
