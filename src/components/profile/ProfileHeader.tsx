/**
 * ProfileHeader – Avatar, display name extracted from email, and streak fire.
 *
 * Tap avatar to pick a new image from the library (stored locally).
 * Streak shows a subtle flame icon with the count.
 */

import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography, BorderRadius } from '../../utils/colors';
import { haptic } from '../../utils/haptics';

interface ProfileHeaderProps {
  email: string;
  avatarUri: string | null;
  currentStreak: number;
  onChangeAvatar: () => void;
}

export const ProfileHeader = memo(function ProfileHeader({
  email,
  avatarUri,
  currentStreak,
  onChangeAvatar,
}: ProfileHeaderProps) {
  const displayName = email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleAvatarPress = useCallback(() => {
    haptic('light');
    onChangeAvatar();
  }, [onChangeAvatar]);

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.container}>
      {/* Avatar */}
      <Pressable onPress={handleAvatarPress} style={styles.avatarContainer}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.editBadge}>
          <Icon name="camera-outline" size={12} color={Colors.white} />
        </View>
      </Pressable>

      {/* Name & Email */}
      <Animated.View
        entering={FadeInDown.delay(80).duration(350)}
        style={styles.nameSection}>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.emailText}>{email}</Text>
      </Animated.View>

      {/* Streak */}
      {currentStreak > 0 && (
        <Animated.View
          entering={FadeInDown.delay(160).duration(300)}
          style={styles.streakContainer}>
          <Icon name="flame-outline" size={18} color={Colors.text} />
          <Text style={styles.streakCount}>{currentStreak}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.gray100,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 1,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gray800,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Colors.text,
  },
  emailText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  streakCount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  streakLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
});
