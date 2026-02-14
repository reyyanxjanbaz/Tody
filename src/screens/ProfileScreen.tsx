/**
 * ProfileScreen – User identity, gamification, calendar & stats.
 *
 * Composes ProfileHeader, XPSection, MonthlyCalendar, and StatsSection
 * into a single scrollable page. Protected by auth — if not logged in
 * the RootNavigator would never render this screen anyway, but we
 * double-check just in case.
 *
 * Avatar is picked via react-native-image-picker-style Alert
 * (or a simple file input placeholder). The URI is persisted to storage.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import { RootStackParamList } from '../types';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { XPSection } from '../components/profile/XPSection';
import { MonthlyCalendar } from '../components/profile/MonthlyCalendar';
import { StatsSection } from '../components/profile/StatsSection';
import { AnimatedPressable } from '../components/ui';
import {
  calculateProfileStats,
  calculateStreaks,
  calculateXP,
} from '../utils/profileStats';
import { getAvatarUri, saveAvatarUri } from '../utils/storage';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../utils/colors';
import { haptic } from '../utils/haptics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tasks, archivedTasks } = useTasks();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Merge active + archived tasks for full picture
  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);

  // Compute stats, streaks, XP
  const profileStats = useMemo(() => calculateProfileStats(allTasks), [allTasks]);
  const streaks = useMemo(() => calculateStreaks(allTasks), [allTasks]);
  const xpData = useMemo(
    () => calculateXP(allTasks, streaks.current),
    [allTasks, streaks.current],
  );

  // Load saved avatar
  useEffect(() => {
    (async () => {
      const uri = await getAvatarUri();
      if (uri) setAvatarUri(uri);
    })();
  }, []);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleOpenSettings = useCallback(() => {
    haptic('light');
    navigation.navigate('Settings');
  }, [navigation]);

  const handleChangeAvatar = useCallback(() => {
    // Since we don't have react-native-image-picker installed,
    // show a prompt for a URL as a lightweight placeholder.
    // In production this would open the camera roll.
    Alert.prompt(
      'Set Avatar',
      'Paste an image URL (or leave blank to remove)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (value?: string) => {
            if (value && value.trim()) {
              setAvatarUri(value.trim());
              await saveAvatarUri(value.trim());
            } else {
              setAvatarUri(null);
              await saveAvatarUri('');
            }
            haptic('success');
          },
        },
      ],
      'plain-text',
      avatarUri ?? '',
    );
  }, [avatarUri]);

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <AnimatedPressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </AnimatedPressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        {/* Profile Header – avatar, name, streak */}
        <ProfileHeader
          email={user.email}
          avatarUri={avatarUri}
          currentStreak={streaks.current}
          onChangeAvatar={handleChangeAvatar}
        />

        {/* XP & Level */}
        <XPSection xp={xpData} />

        {/* Settings Button */}
        <Animated.View
          entering={FadeInDown.delay(240).duration(300)}
          style={styles.settingsButtonWrap}>
          <AnimatedPressable
            onPress={handleOpenSettings}
            hapticStyle="light"
            style={styles.settingsButton}>
            <Icon name="settings-outline" size={18} color={Colors.white} />
            <Text style={styles.settingsButtonText}>Settings</Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Monthly Calendar */}
        <MonthlyCalendar tasks={allTasks} />

        {/* Statistics */}
        <StatsSection stats={profileStats} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  backText: {
    ...Typography.link,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.sm,
  },
  settingsButtonWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceDark,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.button,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});
