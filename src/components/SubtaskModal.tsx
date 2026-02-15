/**
 * SubtaskModal — Floating island card for adding subtasks.
 *
 * A uniformly-rounded card that springs into the center of the screen
 * with a soft backdrop blur. No bottom-sheet tropes — no drag handle,
 * no asymmetric corners. Just a clean, centered floating form.
 *
 * Uses the full TaskInput component so subtasks get the same
 * creation experience as top-level tasks.
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  Spacing,
  Typography,
  BorderRadius,
  FontFamily,
  type ThemeColors,
} from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { TaskInput, TaskInputParams } from './TaskInput';
import { Category } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_W - 32, 400);

interface SubtaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, params?: TaskInputParams) => void;
  categories?: Category[];
  defaultCategory?: string;
}

export const SubtaskModal = memo(function SubtaskModal({
  visible,
  onClose,
  onSubmit,
  categories,
  defaultCategory,
}: SubtaskModalProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Card entrance animation
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withSpring(1, {
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      });
    } else {
      progress.value = withTiming(0, { duration: 180 });
    }
  }, [visible, progress]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.85, 1],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [-30, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // Accent line color — subtle glow
  const accentColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Floating card */}
        <Animated.View style={[styles.card, cardAnimStyle]}>
          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.headerLabel}>
              <Icon
                name="git-branch-outline"
                size={16}
                color={colors.textTertiary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.headerText}>New subtask</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
            >
              <Icon name="close" size={18} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: accentColor }]} />

          {/* Task Input */}
          <View style={styles.inputWrap}>
            <TaskInput
              onSubmit={(text, params) => {
                onSubmit(text, params);
              }}
              placeholder="What's the subtask?"
              autoFocus
              compact
              defaultCategory={defaultCategory}
              categories={categories}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// ── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.35)',
    },
    card: {
      width: CARD_WIDTH,
      backgroundColor: isDark ? '#1A1A1C' : '#FFFFFF',
      borderRadius: 20,
      overflow: 'hidden',
      // Uniform shadow on all sides
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.5 : 0.15,
      shadowRadius: 24,
      elevation: 20,
      // Subtle border ring
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    headerLabel: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerText: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.3,
      color: c.textTertiary,
      fontFamily: FontFamily,
      textTransform: 'uppercase',
    },
    closeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    divider: {
      height: 1,
      marginHorizontal: Spacing.lg,
    },
    inputWrap: {
      paddingBottom: Spacing.md,
      paddingTop: Spacing.xs,
      // Offset left margin from TaskInput's own margins
      marginHorizontal: -Spacing.lg + 4,
    },
  });
