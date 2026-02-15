/**
 * SubtaskModal — Unified popup for adding subtasks.
 *
 * Uses the full TaskInput component so subtasks get the same
 * creation experience as top-level tasks (energy, priority,
 * category, estimate, deadline pills).
 *
 * Used in both HomeScreen (via long-press / swipe) and
 * TaskDetailScreen (inline "Add subtask" button).
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { TaskInput, TaskInputParams } from './TaskInput';
import { Category } from '../types';

interface SubtaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, params?: TaskInputParams) => void;
  /** Available categories (excluding Overview) */
  categories?: Category[];
  /** Default category inherited from parent task */
  defaultCategory?: string;
}

export const SubtaskModal = memo(function SubtaskModal({
  visible,
  onClose,
  onSubmit,
  categories,
  defaultCategory,
}: SubtaskModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Animated.View
          entering={FadeIn.duration(250)}
          style={styles.card}
        >
          <Text style={styles.title}>Add subtask</Text>
          <TaskInput
            onSubmit={(text, params) => {
              onSubmit(text, params);
            }}
            placeholder="Subtask title..."
            autoFocus
            defaultCategory={defaultCategory}
            categories={categories}
          />
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: '85%',
      backgroundColor: c.surface,
      borderRadius: BorderRadius.card,
      paddingVertical: Spacing.xxl,
      paddingHorizontal: Spacing.xxl,
      borderWidth: 1,
      borderColor: c.border,
    },
    title: {
      ...Typography.bodyMedium,
      color: c.text,
      textAlign: 'center',
    },
    cancelButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      alignSelf: 'center',
    },
    cancelText: {
      ...Typography.body,
      color: c.textTertiary,
    },
  });
