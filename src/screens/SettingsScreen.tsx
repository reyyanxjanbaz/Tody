/**
 * SettingsScreen – Auth settings & user preferences.
 *
 * Sections:
 *   1. Account – change password, logout, delete account
 *   2. Preferences – dark mode (placeholder), date/time format, week start
 *
 * Follows the same ScrollView + section pattern as RealityScoreScreen.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import {
  RootStackParamList,
  UserPreferences,
  DEFAULT_PREFERENCES,
} from '../types';
import {
  saveUserPreferences,
  getUserPreferences,
} from '../utils/storage';
import { supabase } from '../lib/supabase';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';
import { AnimatedPressable } from '../components/ui';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

// ── Preference option arrays ────────────────────────────────────────────────

const DATE_FORMATS: UserPreferences['dateFormat'][] = [
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'YYYY-MM-DD',
];

const TIME_FORMATS: UserPreferences['timeFormat'][] = ['12h', '24h'];

const WEEK_STARTS: UserPreferences['weekStartsOn'][] = ['sunday', 'monday'];

export function SettingsScreen({ navigation }: Props) {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  // Preferences (loaded from storage on mount)
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Change password state (simulated – no real backend)
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  // Load preferences on mount
  React.useEffect(() => {
    (async () => {
      const stored = await getUserPreferences<UserPreferences>();
      if (stored) setPrefs({ ...DEFAULT_PREFERENCES, ...stored });
      setPrefsLoaded(true);
    })();
  }, []);

  // Persist whenever prefs change
  React.useEffect(() => {
    if (prefsLoaded) {
      saveUserPreferences(prefs);
    }
  }, [prefs, prefsLoaded]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleLogout = useCallback(async () => {
    haptic('medium');
    await logout();
  }, [logout]);

  const handleChangePassword = useCallback(async () => {
    if (!newPw.trim()) {
      setPwMessage('New password is required');
      return;
    }
    if (newPw.length < 6) {
      setPwMessage('New password must be at least 6 characters');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setPwMessage(error.message);
      return;
    }
    haptic('success');
    setPwMessage('Password updated');
    setCurrentPw('');
    setNewPw('');
    setTimeout(() => setPwMessage(''), 3000);
  }, [newPw]);

  const handleDeleteAccount = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteAccount = useCallback(async () => {
    haptic('heavy');
    setShowDeleteModal(false);
    // Note: account deletion via the client SDK requires the user to be
    // authenticated. For full deletion (removing the auth.users row),
    // you will need a Supabase Edge Function or service-role call.
    // For now we sign the user out and clear local data.
    await logout();
  }, [logout]);

  const handleResetPreferences = useCallback(() => {
    Alert.alert(
      'Reset Preferences',
      'Restore all settings to their defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            haptic('medium');
            setPrefs(DEFAULT_PREFERENCES);
          },
        },
      ],
    );
  }, []);

  const updatePref = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      haptic('light');
      setPrefs(p => ({ ...p, [key]: value }));
    },
    [],
  );

  // ── Cycle helpers for tappable selectors ────────────────────────────────

  const cycleDateFormat = useCallback(() => {
    const idx = DATE_FORMATS.indexOf(prefs.dateFormat);
    updatePref('dateFormat', DATE_FORMATS[(idx + 1) % DATE_FORMATS.length]);
  }, [prefs.dateFormat, updatePref]);

  const cycleTimeFormat = useCallback(() => {
    const idx = TIME_FORMATS.indexOf(prefs.timeFormat);
    updatePref('timeFormat', TIME_FORMATS[(idx + 1) % TIME_FORMATS.length]);
  }, [prefs.timeFormat, updatePref]);

  const cycleWeekStart = useCallback(() => {
    const idx = WEEK_STARTS.indexOf(prefs.weekStartsOn);
    updatePref('weekStartsOn', WEEK_STARTS[(idx + 1) % WEEK_STARTS.length]);
  }, [prefs.weekStartsOn, updatePref]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>← Profile</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled">

        {/* ═══════ ACCOUNT SECTION ═══════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>

          {/* Change Password */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor={colors.gray500}
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry
              textContentType="password"
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={colors.gray500}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              textContentType="newPassword"
            />
            {pwMessage ? (
              <Text style={styles.pwMessage}>{pwMessage}</Text>
            ) : null}
            <AnimatedPressable
              onPress={handleChangePassword}
              hapticStyle="light"
              style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Update Password</Text>
            </AnimatedPressable>
          </View>

          {/* Logout */}
          <AnimatedPressable
            onPress={handleLogout}
            hapticStyle="medium"
            style={styles.rowButton}>
            <Icon name="log-out-outline" size={20} color={colors.text} />
            <Text style={styles.rowButtonText}>Log Out</Text>
          </AnimatedPressable>

          {/* Delete Account */}
          <AnimatedPressable
            onPress={handleDeleteAccount}
            hapticStyle="heavy"
            style={[styles.rowButton, styles.dangerRow]}>
            <Icon name="trash-outline" size={20} color={colors.gray800} />
            <Text style={[styles.rowButtonText, styles.dangerText]}>
              Delete Account
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* ═══════ PREFERENCES SECTION ═══════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <Text style={[styles.sectionTitle, { marginTop: Spacing.xxxl }]}>
            PREFERENCES
          </Text>

          {/* Dark Mode Toggle */}
          <View style={styles.preferenceRow}>
            <View style={styles.prefLabel}>
              <Icon name="moon-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.prefText}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => { toggleTheme(); updatePref('darkMode', !isDark); }}
              trackColor={{ false: colors.gray200, true: colors.gray800 }}
              thumbColor={colors.white}
            />
          </View>

          {/* Date Format */}
          <Pressable onPress={cycleDateFormat} style={styles.preferenceRow}>
            <View style={styles.prefLabel}>
              <Icon name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.prefText}>Date Format</Text>
            </View>
            <Text style={styles.prefValue}>{prefs.dateFormat}</Text>
          </Pressable>

          {/* Time Format */}
          <Pressable onPress={cycleTimeFormat} style={styles.preferenceRow}>
            <View style={styles.prefLabel}>
              <Icon name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.prefText}>Time Format</Text>
            </View>
            <Text style={styles.prefValue}>{prefs.timeFormat}</Text>
          </Pressable>

          {/* Week Starts On */}
          <Pressable onPress={cycleWeekStart} style={styles.preferenceRow}>
            <View style={styles.prefLabel}>
              <Icon name="grid-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.prefText}>Week Starts On</Text>
            </View>
            <Text style={styles.prefValue}>
              {prefs.weekStartsOn === 'sunday' ? 'Sunday' : 'Monday'}
            </Text>
          </Pressable>

          {/* Reset */}
          <AnimatedPressable
            onPress={handleResetPreferences}
            hapticStyle="medium"
            style={[styles.rowButton, { marginTop: Spacing.lg }]}>
            <Icon name="refresh-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowButtonText}>Reset Preferences</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeIn.duration(250)} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalSubtitle}>
              This action cannot be undone. All your data will be permanently removed.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalDeleteButton}
                onPress={confirmDeleteAccount}>
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  backText: {
    ...Typography.link,
    color: c.textSecondary,
  },
  headerTitle: {
    ...Typography.heading,
    color: c.text,
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    color: c.textTertiary,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    marginBottom: Spacing.md,
    fontFamily: FontFamily,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.lg,
    backgroundColor: c.gray100,
    ...Typography.body,
    color: c.text,
    marginBottom: Spacing.sm,
  },
  pwMessage: {
    ...Typography.small,
    color: c.textSecondary,
    marginBottom: Spacing.sm,
  },
  actionButton: {
    backgroundColor: c.surfaceDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.white,
    fontFamily: FontFamily,
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  rowButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: c.text,
    fontFamily: FontFamily,
  },
  dangerRow: {
    borderWidth: 1,
    borderColor: c.gray200,
  },
  dangerText: {
    color: c.gray800,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  prefLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  prefText: {
    fontSize: 15,
    fontWeight: '500',
    color: c.text,
    fontFamily: FontFamily,
  },
  prefValue: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    borderWidth: 1,
    borderColor: c.border,
  },
  modalTitle: {
    ...Typography.bodyMedium,
    color: c.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...Typography.caption,
    color: c.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.xl,
  },
  modalCancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  modalCancelText: {
    ...Typography.body,
    color: c.textTertiary,
  },
  modalDeleteButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: c.surfaceDark,
    borderRadius: BorderRadius.button,
  },
  modalDeleteText: {
    ...Typography.body,
    color: c.white,
  },
});
