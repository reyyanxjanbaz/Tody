/**
 * TaskItem – the centrepiece interaction component.
 *
 * Technical showcase:
 * ─ Reanimated 3 shared values + worklets for 60fps swipe/press
 * ─ Gesture Handler v2 composable gestures (Pan + Tap + LongPress)
 * ─ Physics-based springs (SPRING_SNAPPY / SPRING_CRITICAL)
 * ─ Haptic feedback on swipe thresholds and completion
 * ─ AnimatedCheckbox with morphing + path interpolation
 * ─ Layout animations via Reanimated entering/exiting
 *
 * Gesture semantics:
 *   Swipe right → START (unstarted) or DEFER (other)
 *   Swipe left  → DONE / REVIVE / COMPLETE (timed)
 *   Tap         → Navigate to detail
 *   Long-press  → Context menu
 */

import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Task, Priority } from '../types';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { formatDeadline, formatCompletedDate, daysFromNow } from '../utils/dateUtils';
import { formatOverdueGently } from '../utils/decay';
import { formatMinutes, getElapsedMinutes, isUnreasonableDuration } from '../utils/timeTracking';
import { recordSwipeAction } from '../utils/swipeMemory';
import { AnimatedCheckbox } from './ui/AnimatedCheckbox';
import {
  SPRING_SNAPPY,
  SPRING_CRITICAL,
  TIMING_FADE,
  SWIPE_THRESHOLD,
  FLING_VELOCITY,
  PRESS_SCALE,
} from '../utils/animations';
import { haptic } from '../utils/haptics';

// ── Props ───────────────────────────────────────────────────────────────────

interface TaskItemProps {
  task: Task;
  onPress: (task: Task) => void;
  onComplete: (id: string) => void;
  onDefer: (id: string) => void;
  onRevive?: (id: string) => void;
  onStart?: (id: string) => void;
  onCompleteTimed?: (id: string, adjustedMinutes?: number) => void;
  isLocked?: boolean;
  isLastChild?: boolean;
  onLongPress?: (task: Task) => void;
  onAddSubtask?: (task: Task) => void;
  childHighlight?: boolean;
  checkedOverride?: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

// ── Dashed Line ─────────────────────────────────────────────────────────────

const DASH_WIDTH = 4;
const DASH_GAP = 3;
const DASH_HEIGHT = 1;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SEPARATOR_INSET = 24;
const DASH_COUNT = Math.ceil((SCREEN_WIDTH - SEPARATOR_INSET * 2) / (DASH_WIDTH + DASH_GAP));

// ── Component ───────────────────────────────────────────────────────────────

export const TaskItem = memo(function TaskItem({
  task,
  onPress,
  onComplete,
  onDefer,
  onRevive,
  onStart,
  onCompleteTimed,
  isLocked = false,
  isLastChild = false,
  onLongPress,
  onAddSubtask,
  childHighlight = false,
  checkedOverride,
}: TaskItemProps) {
  // ── Shared values ─────────────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const hasPassedThreshold = useSharedValue(false);

  // ── Computed ──────────────────────────────────────────────────────────
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const PRIORITY_COLORS: Record<Priority, string> = useMemo(() => ({
    high: colors.text,
    medium: colors.gray500,
    low: colors.gray200,
    none: 'transparent',
  }), [colors]);

  const overdueLabel = useMemo(() => formatOverdueGently(task), [task]);
  const isOverdue = task.deadline ? daysFromNow(task.deadline) < 0 : false;
  const isInProgress = !!task.startedAt && !task.isCompleted;
  const indentation = (task.depth || 0) * 16;
  const hasChildren = task.childIds && task.childIds.length > 0;

  // ── JS callbacks (run on JS thread via runOnJS) ───────────────────────

  const handlePress = useCallback(() => {
    onPress(task);
  }, [task, onPress]);

  const handleLongPressAction = useCallback(() => {
    haptic('medium');
    onLongPress?.(task);
  }, [task, onLongPress]);

  const handleSwipeRight = useCallback(() => {
    if (!task.startedAt && !task.isCompleted && onStart) {
      recordSwipeAction('start');
      haptic('medium');
      onStart(task.id);
    } else {
      recordSwipeAction('defer');
      haptic('medium');
      onDefer(task.id);
    }
  }, [task, onStart, onDefer]);

  const handleSwipeLeft = useCallback(() => {
    if (isOverdue && onRevive) {
      recordSwipeAction('revive');
      haptic('success');
      onRevive(task.id);
    } else if (isInProgress && onCompleteTimed) {
      const elapsed = getElapsedMinutes(task.startedAt!);
      if (isUnreasonableDuration(elapsed)) {
        haptic('warning');
        Alert.alert(
          'Long duration',
          `This task has been running for ${formatMinutes(elapsed)}. Did you work on it continuously?`,
          [
            { text: 'Use actual time', onPress: () => onCompleteTimed(task.id) },
            {
              text: 'Adjust',
              onPress: () => {
                Alert.prompt(
                  'Actual time (minutes)',
                  'How many minutes did you actually work?',
                  (text) => {
                    const mins = parseInt(text, 10);
                    if (!isNaN(mins) && mins > 0) {
                      onCompleteTimed(task.id, mins);
                    } else {
                      onCompleteTimed(task.id);
                    }
                  },
                  'plain-text',
                  '',
                  'number-pad',
                );
              },
            },
          ],
        );
      } else {
        recordSwipeAction('complete');
        haptic('success');
        onComplete(task.id);
      }
    } else {
      recordSwipeAction('complete');
      haptic('success');
      onComplete(task.id);
    }
  }, [task, isOverdue, isInProgress, onRevive, onCompleteTimed, onComplete]);

  const handleCheckboxToggle = useCallback(() => {
    if (isLocked) return; // AnimatedCheckbox handles the shake + haptic
    haptic('success');
    onComplete(task.id);
  }, [task.id, onComplete, isLocked]);

  const fireThresholdHaptic = useCallback(() => {
    haptic('light');
  }, []);

  // ── Gestures ──────────────────────────────────────────────────────────

  const panGesture = Gesture.Pan()
    .enabled(!task.isCompleted)
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      'worklet';
      translateX.value = e.translationX;

      const crossedRight = e.translationX > SWIPE_THRESHOLD;
      const crossedLeft = e.translationX < -SWIPE_THRESHOLD;
      if ((crossedRight || crossedLeft) && !hasPassedThreshold.value) {
        hasPassedThreshold.value = true;
        runOnJS(fireThresholdHaptic)();
      } else if (!crossedRight && !crossedLeft) {
        hasPassedThreshold.value = false;
      }
    })
    .onEnd((e) => {
      'worklet';
      const shouldActivate =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > FLING_VELOCITY;

      if (shouldActivate) {
        if (e.translationX > 0) {
          translateX.value = withSpring(0, SPRING_CRITICAL);
          runOnJS(handleSwipeRight)();
        } else {
          translateX.value = withSpring(0, SPRING_CRITICAL);
          runOnJS(handleSwipeLeft)();
        }
      } else {
        translateX.value = withSpring(0, SPRING_SNAPPY);
      }
      hasPassedThreshold.value = false;
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      pressScale.value = withSpring(PRESS_SCALE, SPRING_SNAPPY);
    })
    .onFinalize((_e, success) => {
      'worklet';
      pressScale.value = withSpring(1, SPRING_SNAPPY);
      if (success) {
        runOnJS(handlePress)();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(!!onLongPress)
    .minDuration(350)
    .onStart(() => {
      'worklet';
      runOnJS(handleLongPressAction)();
    })
    .onFinalize(() => {
      'worklet';
      pressScale.value = withSpring(1, SPRING_SNAPPY);
    });

  const composed = Gesture.Simultaneous(
    panGesture,
    Gesture.Exclusive(longPressGesture, tapGesture),
  );

  // ── Animated styles ───────────────────────────────────────────────────

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: pressScale.value },
    ],
  }));

  const leftActionStyle = useAnimatedStyle(() => {
    const o = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.6],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const s = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0.8, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: o, transform: [{ scale: s }] };
  });

  const rightActionStyle = useAnimatedStyle(() => {
    const o = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const s = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0.5],
      Extrapolation.CLAMP,
    );
    return { opacity: o, transform: [{ scale: s }] };
  });

  const leftActionBgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? 1 : 0,
    zIndex: translateX.value > 0 ? 1 : 0,
  }));

  const rightActionBgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? 1 : 0,
    zIndex: translateX.value < 0 ? 1 : 0,
  }));

  // ── Labels ────────────────────────────────────────────────────────────
  const leftLabel = !task.startedAt && !task.isCompleted && onStart ? 'START' : 'DEFER';
  const rightLabel = isOverdue && onRevive ? 'REVIVE' : isInProgress ? 'COMPLETE' : 'DONE';

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(250)}
      style={styles.outerContainer}
    >
      <View>
        {/* Left action background (revealed on swipe right) */}
        <Animated.View style={[styles.leftActionBg, leftActionBgAnimatedStyle]}>
          <Animated.Text style={[styles.swipeActionText, leftActionStyle]}>
            {leftLabel}
          </Animated.Text>
        </Animated.View>

        {/* Right action background (revealed on swipe left) */}
        <Animated.View style={[styles.rightActionBg, rightActionBgAnimatedStyle]}>
          <Animated.Text style={[styles.swipeActionText, rightActionStyle]}>
            {rightLabel}
          </Animated.Text>
        </Animated.View>

        {/* Main row */}
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.container, rowAnimatedStyle]}>
            <View style={[styles.innerContainer, { paddingLeft: indentation }]}>
              {/* Connector lines for subtasks */}
              {task.depth > 0 && (
                <View
                  style={[
                    styles.connectorVertical,
                    {
                      left: indentation - 8,
                      height: isLastChild ? '50%' : '100%',
                      top: 0,
                    },
                  ]}
                />
              )}
              {task.depth > 0 && (
                <View
                  style={[styles.connectorHorizontal, { left: indentation - 8 }]}
                />
              )}

              {/* Priority indicator bar */}
              <View
                style={[
                  styles.priorityBar,
                  { backgroundColor: PRIORITY_COLORS[task.priority] },
                ]}
              />

              {/* Lock icon */}
              {isLocked && (
                <View style={styles.lockIcon}>
                  <Text style={styles.lockIconText}>🔒</Text>
                </View>
              )}

              {/* Animated Checkbox */}
              <View style={styles.checkboxContainer}>
                <AnimatedCheckbox
                  checked={checkedOverride !== undefined ? checkedOverride : task.isCompleted}
                  locked={isLocked}
                  onToggle={handleCheckboxToggle}
                  size={18}
                />
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text
                  style={[
                    styles.title,
                    task.isCompleted && styles.titleCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
                {task.description ? (
                  <Text style={styles.description} numberOfLines={1}>
                    {task.description}
                  </Text>
                ) : null}
                {isInProgress && task.startedAt ? (
                  <Text style={styles.timingText}>
                    ● Started {formatMinutes(getElapsedMinutes(task.startedAt))} ago
                    {task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}
                  </Text>
                ) : task.isCompleted && task.actualMinutes != null && task.actualMinutes > 0 ? (
                  <Text style={styles.timingText}>
                    Took {formatMinutes(task.actualMinutes)}
                    {task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}
                  </Text>
                ) : task.estimatedMinutes ? (
                  <Text style={styles.timingText}>
                    est. {formatMinutes(task.estimatedMinutes)}
                  </Text>
                ) : null}
              </View>

              {/* Deadline / Status */}
              {task.isCompleted && task.completedAt ? (
                <Text style={styles.completedTag}>
                  {formatCompletedDate(task.completedAt)}
                </Text>
              ) : isOverdue && overdueLabel ? (
                <Text style={styles.overdueTagGentle}>{overdueLabel}</Text>
              ) : task.deadline ? (
                <Text style={styles.deadlineTag}>{formatDeadline(task.deadline)}</Text>
              ) : null}

              {/* Defer count */}
              {task.deferCount > 0 && !task.isCompleted ? (
                <Text style={styles.deferBadge}>{task.deferCount}×</Text>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>

        <View style={styles.dashedSeparator}>
          {Array.from({ length: DASH_COUNT }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
});

// ── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => StyleSheet.create({
  outerContainer: {
    position: 'relative',
    overflow: 'visible',
    backgroundColor: c.background,
  },
  dashedSeparator: {
    flexDirection: 'row',
    marginHorizontal: SEPARATOR_INSET,
    height: DASH_HEIGHT,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dash: {
    width: DASH_WIDTH,
    height: DASH_HEIGHT,
    backgroundColor: c.border,
    marginRight: DASH_GAP,
    borderRadius: 0.5,
  },
  container: {
    backgroundColor: c.background,
    zIndex: 1,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md + 2,
    paddingRight: Spacing.lg,
    paddingLeft: Spacing.md,
    minHeight: 56,
  },
  leftActionBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.gray800,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 24,
    zIndex: 0,
  },
  rightActionBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.surfaceDark,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
    zIndex: 0,
  },
  swipeActionText: {
    color: c.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: FontFamily,
  },
  priorityBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: Spacing.sm,
    borderRadius: 2,
  },
  checkboxContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
    color: c.text,
    fontFamily: FontFamily,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: c.gray500,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: c.textTertiary,
    marginTop: 2,
    fontFamily: FontFamily,
  },
  timingText: {
    fontSize: 11,
    color: c.gray500,
    marginTop: 2,
    fontFamily: FontFamily,
  },
  deadlineTag: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: c.textTertiary,
    fontFamily: FontFamily,
  },
  overdueTagGentle: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: c.gray400,
    fontFamily: FontFamily,
  },
  completedTag: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: c.gray400,
    fontFamily: FontFamily,
  },
  deferBadge: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: c.gray400,
    marginLeft: Spacing.xs,
    fontFamily: FontFamily,
  },
  connectorVertical: {
    position: 'absolute',
    width: 1,
    backgroundColor: c.gray400,
  },
  connectorHorizontal: {
    position: 'absolute',
    width: 8,
    height: 1,
    backgroundColor: c.gray400,
    opacity: 0.5,
  },
  lockIcon: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  lockIconText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
