import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography, BorderRadius, Shadows, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { SortOption } from '../types';
import { haptic } from '../utils/haptics';

const SORT_OPTIONS: { key: SortOption; label: string; icon: string; description?: string }[] = [
  { key: 'default',       label: 'Default (Sections)',  icon: 'layers-outline' },
  { key: 'smart',         label: 'Smart Sort',          icon: 'sparkles-outline', description: 'Priority + Deadline + Energy + Time' },
  { key: 'deadline-asc',  label: 'Deadline — soonest',  icon: 'arrow-up-outline' },
  { key: 'deadline-desc', label: 'Deadline — latest',   icon: 'arrow-down-outline' },
  { key: 'priority-high', label: 'Priority — high first', icon: 'flag' },
  { key: 'priority-low',  label: 'Priority — low first',  icon: 'flag-outline' },
  { key: 'newest',        label: 'Created — newest',    icon: 'time-outline' },
  { key: 'oldest',        label: 'Created — oldest',    icon: 'hourglass-outline' },
];

interface SortDropdownProps {
  visible: boolean;
  current: SortOption;
  onSelect: (option: SortOption) => void;
  onClose: () => void;
}

export const SortDropdown = memo(function SortDropdown({
  visible,
  current,
  onSelect,
  onClose,
}: SortDropdownProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.modalOverlay }]} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={[styles.card, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Sort Tasks</Text>
          {SORT_OPTIONS.map((opt) => {
            const isActive = current === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[styles.row, isActive && { backgroundColor: colors.gray50 }]}
                onPress={() => {
                  haptic('selection');
                  onSelect(opt.key);
                }}
              >
                <Icon
                  name={opt.icon}
                  size={16}
                  color={isActive ? colors.text : colors.gray500}
                />
                <View style={styles.rowTextContainer}>
                  <Text style={[styles.rowText, { color: colors.textSecondary }, isActive && { color: colors.text, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                  {opt.description && (
                    <Text style={[styles.rowDescription, { color: colors.textTertiary }]}>{opt.description}</Text>
                  )}
                </View>
                {isActive && (
                  <Icon name="checkmark" size={18} color={colors.text} />
                )}
              </Pressable>
            );
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '80%',
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: 10,
    borderRadius: 8,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowDescription: {
    fontSize: 11,
    marginTop: 1,
  },
});
