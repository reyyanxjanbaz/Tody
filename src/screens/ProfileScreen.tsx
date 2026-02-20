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
import { RootStackParamList, ProfileStats } from '../types';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { XPSection } from '../components/profile/XPSection';
import { MonthlyCalendar } from '../components/profile/MonthlyCalendar';
import { PerformanceFusionSection } from '../components/profile/PerformanceFusionSection';
import { AnimatedPressable, PromptModal } from '../components/ui';
import { calculateXP } from '../utils/profileStats';
import { getAvatarUri, saveAvatarUri } from '../utils/storage';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';
import { api } from '../lib/api';

// ── Backend response shapes ──────────────────────────────────────────────────

interface BackendStats {
  total_created: number;
  total_completed: number;
  total_incomplete: number;
  total_minutes_spent: number;
  avg_minutes_per_task: number;
  completion_percentage: number;
  active_days: number;
}

interface BackendAnalytics {
  current_streak: number;
  best_streak: number;
  daily_trend: Array<{ date: string; created: number; completed: number }>;
}

const ZERO_STATS: ProfileStats = {
  totalCreated: 0,
  totalCompleted: 0,
  totalIncomplete: 0,
  completionPercentage: 0,
  currentStreak: 0,
  bestStreak: 0,
  averageTasksPerDay: 0,
  totalMinutesSpent: 0,
  averageMinutesPerTask: 0,
  mostProductiveDay: '\u2014',
};

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function mostProductiveDayFromTrend(
  trend: BackendAnalytics['daily_trend'],
): string {
  const totals = new Array(7).fill(0);
  for (const row of trend) {
    // Parse YYYY-MM-DD as UTC midnight to avoid DST offset issues
    const d = new Date(row.date + 'T00:00:00Z');
    totals[d.getUTCDay()] += row.completed;
  }
  const max = Math.max(...totals);
  return max > 0 ? DOW_LABELS[totals.indexOf(max)] : '\u2014';
}

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

  // Profile stats & analytics fetched from the Render backend
  const [profileStats, setProfileStats] = useState<ProfileStats>(ZERO_STATS);

  // Merge active + archived tasks for local computations (XP, calendar)
  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);

  // ── Fetch stats + analytics from backend ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statsRes, analyticsRes] = await Promise.all([
        api.get<BackendStats>('/profile/stats'),
        api.get<BackendAnalytics>('/profile/analytics'),
      ]);
      if (cancelled) return;

      const s = statsRes.data;
      const a = analyticsRes.data;
      if (s && a) {
        setProfileStats({
          totalCreated: s.total_created ?? 0,
          totalCompleted: s.total_completed ?? 0,
          totalIncomplete: s.total_incomplete ?? 0,
          completionPercentage: s.completion_percentage ?? 0,
          currentStreak: a.current_streak ?? 0,
          bestStreak: a.best_streak ?? 0,
          averageTasksPerDay:
            s.active_days > 0
              ? Math.round((s.total_created / s.active_days) * 10) / 10
              : 0,
          totalMinutesSpent: s.total_minutes_spent ?? 0,
          averageMinutesPerTask: s.avg_minutes_per_task ?? 0,
          mostProductiveDay: mostProductiveDayFromTrend(a.daily_trend ?? []),
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // XP uses the backend-sourced current streak
  const xpData = useMemo(
    () => calculateXP(allTasks, profileStats.currentStreak),
    [allTasks, profileStats.currentStreak],
  );

  // Load saved avatar; also check backend for reinstall recovery
  useEffect(() => {
    (async () => {
      const localUri = await getAvatarUri();
      if (localUri) setAvatarUri(localUri);

      // Fetch profile from backend — if it has an avatar_url and we don't
      // have one locally, apply and save it (survives reinstalls).
      const { data } = await api.get<{ avatar_url?: string | null }>('/profile');
      if (data?.avatar_url && !localUri) {
        setAvatarUri(data.avatar_url);
        await saveAvatarUri(data.avatar_url);
      }
    })();
  }, []);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleOpenSettings = useCallback(() => {
    haptic('light');
    navigation.navigate('Settings');
  }, [navigation]);

  const handleChangeAvatar = useCallback(() => {
    const handleSave = async (value: string) => {
      const url = value.trim();
      if (url) {
        setAvatarUri(url);
        await saveAvatarUri(url);
      } else {
        setAvatarUri(null);
        await saveAvatarUri('');
      }
      // Sync avatar URL to backend so it survives reinstalls
      api.patch('/profile', { avatar_url: url || null }).catch(() => {});
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
          currentStreak={profileStats.currentStreak}
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
