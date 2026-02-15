/**
 * ProfileScreen – User identity, gamification, calendar & stats.
 *
 * Composes ProfileHeader, XPSection, MonthlyCalendar, and PerformanceFusionSection
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import { RootStackParamList } from '../types';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { XPSection } from '../components/profile/XPSection';
import { MonthlyCalendar } from '../components/profile/MonthlyCalendar';
import { PerformanceFusionSection } from '../components/profile/PerformanceFusionSection';
import { AnimatedPressable, PromptModal } from '../components/ui';
import {
  calculateProfileStats,
  calculateStreaks,
  calculateXP,
} from '../utils/profileStats';
import { getAvatarUri, saveAvatarUri } from '../utils/storage';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tasks, archivedTasks } = useTasks();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarPromptVisible, setAvatarPromptVisible] = useState(false);

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
    const handleSave = async (value: string) => {
      if (value.trim()) {
        setAvatarUri(value.trim());
        await saveAvatarUri(value.trim());
      } else {
        setAvatarUri(null);
        await saveAvatarUri('');
      }
      haptic('success');
    };

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Set Avatar',
        'Paste an image URL (or leave blank to remove)',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: (v?: string) => handleSave(v ?? '') },
        ],
        'plain-text',
        avatarUri ?? '',
      );
    } else {
      setAvatarPromptVisible(true);
    }
  }, [avatarUri]);

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <AnimatedPressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <AnimatedPressable
          onPress={handleOpenSettings}
          hapticStyle="light"
          style={styles.settingsRoundButton}>
          <Icon name="settings-outline" size={18} color={colors.white} />
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

        {/* Monthly Calendar */}
        <MonthlyCalendar tasks={allTasks} />

        {/* Unified analytics narrative: stats + reality score */}
        <PerformanceFusionSection stats={profileStats} tasks={allTasks} />
      </ScrollView>

      {/* Android avatar URL prompt */}
      <PromptModal
        visible={avatarPromptVisible}
        title="Set Avatar"
        message="Paste an image URL (or leave blank to remove)"
        defaultValue={avatarUri ?? ''}
        onSubmit={async (v) => {
          setAvatarPromptVisible(false);
          if (v.trim()) {
            setAvatarUri(v.trim());
            await saveAvatarUri(v.trim());
          } else {
            setAvatarUri(null);
            await saveAvatarUri('');
          }
          haptic('success');
        }}
        onCancel={() => setAvatarPromptVisible(false)}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  backText: {
    ...Typography.link,
    color: c.textSecondary,
  },
  headerTitle: {
    ...Typography.bodyMedium,
    color: c.text,
  },
  settingsRoundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.sm,
  },
});
