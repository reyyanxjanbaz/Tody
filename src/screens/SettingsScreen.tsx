/**
 * SettingsScreen – Auth settings & user preferences.
 *
 * Sections:
 *   1. Account – change password, logout, delete account
 *   2. Preferences – dark mode (placeholder), date/time format, week start
 *
 * Follows the same ScrollView + section pattern as RealityScoreScreen.
 */

import React, { useState, useCallback, useMemo } from 'react';
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
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../utils/colors';
import { haptic } from '../utils/haptics';
import { AnimatedPressable } from '../components/ui';
import { useTheme } from '../context/ThemeContext';

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

  const handleChangePassword = useCallback(() => {
    if (!currentPw.trim() || !newPw.trim()) {
      setPwMessage('Both fields are required');
      return;
    }
    if (newPw.length < 6) {
      setPwMessage('New password must be at least 6 characters');
      return;
    }
    // Simulated — no real backend
    haptic('success');
    setPwMessage('Password updated');
    setCurrentPw('');
    setNewPw('');
    setTimeout(() => setPwMessage(''), 3000);
  }, [currentPw, newPw]);

  const handleDeleteAccount = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteAccount = useCallback(async () => {
    haptic('heavy');
    setShowDeleteModal(false);
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

  const { colors, isDark, setDarkMode } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Profile</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled">

        {/* ═══════ ACCOUNT SECTION ═══════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>

          {/* Change Password */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Change Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
              placeholder="Current password"
              placeholderTextColor={colors.textTertiary}
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry
              textContentType="password"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
              placeholder="New password"
              placeholderTextColor={colors.textTertiary}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              textContentType="newPassword"
            />
            {pwMessage ? (
              <Text style={[styles.pwMessage, { color: colors.textSecondary }]}>{pwMessage}</Text>
            ) : null}
            <AnimatedPressable
              onPress={handleChangePassword}
              hapticStyle="light"
              style={[styles.actionButton, { backgroundColor: isDark ? '#F5F5F7' : Colors.surfaceDark }]}>
              <Text style={[styles.actionButtonText, { color: isDark ? '#000' : Colors.white }]}>Update Password</Text>
            </AnimatedPressable>
          </View>

          {/* Logout */}
          <AnimatedPressable
            onPress={handleLogout}
            hapticStyle="medium"
            style={[styles.rowButton, { backgroundColor: colors.card }]}>
            <Icon name="log-out-outline" size={20} color={colors.text} />
            <Text style={[styles.rowButtonText, { color: colors.text }]}>Log Out</Text>
          </AnimatedPressable>

          {/* Delete Account */}
          <AnimatedPressable
            onPress={handleDeleteAccount}
            hapticStyle="heavy"
            style={[styles.rowButton, styles.dangerRow, { backgroundColor: colors.card, borderColor: isDark ? '#333' : Colors.gray200 }]}>
            <Icon name="trash-outline" size={20} color={isDark ? '#FF6B6B' : Colors.gray800} />
            <Text style={[styles.rowButtonText, { color: isDark ? '#FF6B6B' : Colors.gray800 }]}>
              Delete Account
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* ═══════ PREFERENCES SECTION ═══════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <Text style={[styles.sectionTitle, { marginTop: Spacing.xxxl, color: colors.textSecondary }]}>
            PREFERENCES
          </Text>

          {/* Dark Mode Toggle */}
          <View style={[styles.preferenceRow, { backgroundColor: colors.card }]}>
            <View style={styles.prefLabel}>
              <Icon name="moon-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.prefText, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={v => { setDarkMode(v); updatePref('darkMode', v); }}
              trackColor={{ false: Colors.gray200, true: '#555' }}
              thumbColor={Colors.white}
            />
          </View>

          {/* Date Format */}
          <Pressable onPress={cycleDateFormat} style={[styles.preferenceRow, { backgroundColor: colors.card }]}>
            <View style={styles.prefLabel}>
              <Icon name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.prefText, { color: colors.text }]}>Date Format</Text>
            </View>
            <Text style={[styles.prefValue, { color: colors.textSecondary }]}>{prefs.dateFormat}</Text>
          </Pressable>

          {/* Time Format */}
          <Pressable onPress={cycleTimeFormat} style={[styles.preferenceRow, { backgroundColor: colors.card }]}>
            <View style={styles.prefLabel}>
              <Icon name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.prefText, { color: colors.text }]}>Time Format</Text>
            </View>
            <Text style={[styles.prefValue, { color: colors.textSecondary }]}>{prefs.timeFormat}</Text>
          </Pressable>

          {/* Week Starts On */}
          <Pressable onPress={cycleWeekStart} style={[styles.preferenceRow, { backgroundColor: colors.card }]}>
            <View style={styles.prefLabel}>
              <Icon name="grid-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.prefText, { color: colors.text }]}>Week Starts On</Text>
            </View>
            <Text style={[styles.prefValue, { color: colors.textSecondary }]}>
              {prefs.weekStartsOn === 'sunday' ? 'Sunday' : 'Monday'}
            </Text>
          </Pressable>

          {/* Reset */}
          <AnimatedPressable
            onPress={handleResetPreferences}
            hapticStyle="medium"
            style={[styles.rowButton, { marginTop: Spacing.lg, backgroundColor: colors.card }]}>
            <Icon name="refresh-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowButtonText, { color: colors.text }]}>Reset Preferences</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Animated.View entering={FadeIn.duration(250)} style={[styles.modalCard, { backgroundColor: colors.modalBg, borderColor: isDark ? '#333' : 'rgba(0,0,0,0.10)' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Account?</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textTertiary }]}>
              This action cannot be undone. All your data will be permanently removed.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteModal(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textTertiary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteButton, { backgroundColor: '#EF4444' }]}
                onPress={confirmDeleteAccount}>
                <Text style={[styles.modalDeleteText, { color: '#fff' }]}>Delete</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.textSecondary,
  },
  headerTitle: {
    ...Typography.heading,
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
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.gray100,
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  pwMessage: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  actionButton: {
    backgroundColor: Colors.surfaceDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.subtle,
  },
  rowButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  dangerRow: {
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  dangerText: {
    color: Colors.gray800,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.subtle,
  },
  prefLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  prefText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  prefValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
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
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    ...Shadows.floating,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  modalTitle: {
    ...Typography.bodyMedium,
    color: Colors.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
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
    color: Colors.textTertiary,
  },
  modalDeleteButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.surfaceDark,
    borderRadius: BorderRadius.button,
  },
  modalDeleteText: {
    ...Typography.body,
    color: Colors.white,
  },
});
