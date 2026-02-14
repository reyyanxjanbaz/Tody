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
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../utils/colors';
import { SortOption } from '../types';
import { haptic } from '../utils/haptics';

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'default',       label: 'Default (Sections)',  icon: 'layers-outline' },
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.card}>
          <Text style={styles.title}>Sort Tasks</Text>
          {SORT_OPTIONS.map((opt) => {
            const isActive = current === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[styles.row, isActive && styles.rowActive]}
                onPress={() => {
                  haptic('selection');
                  onSelect(opt.key);
                }}
              >
                <Icon
                  name={opt.icon}
                  size={16}
                  color={isActive ? Colors.text : Colors.gray500}
                />
                <Text style={[styles.rowText, isActive && styles.rowTextActive]}>
                  {opt.label}
                </Text>
                {isActive && (
                  <Icon name="checkmark" size={18} color={Colors.text} />
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '80%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadows.floating,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
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
  rowActive: {
    backgroundColor: Colors.gray50,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  rowTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
});
