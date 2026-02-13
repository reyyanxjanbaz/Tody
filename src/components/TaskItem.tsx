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
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatDeadline, formatCompletedDate, daysFromNow } from '../utils/dateUtils';
import { getTaskOpacity, formatOverdueGently } from '../utils/decay';
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
}

// ── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Priority, string> = {
  high: Colors.black,
  medium: Colors.gray500,
  low: Colors.gray200,
  none: 'transparent',
};

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
}: TaskItemProps) {
  // ── Shared values ─────────────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const hasPassedThreshold = useSharedValue(false);

  // ── Computed ──────────────────────────────────────────────────────────
  const opacity = useMemo(() => getTaskOpacity(task), [task]);
  const overdueLabel = useMemo(() => formatOverdueGently(task), [task]);
  const isOverdue = task.deadline ? daysFromNow(task.deadline) < 0 : false;
  const isInProgress = !!task.startedAt && !task.isCompleted;
  const indentation = (task.depth || 0) * 16;
  const hasChildren = task.childIds && task.childIds.length > 0;

  const energyStyle = useMemo(() => {
    switch (task.energyLevel) {
      case 'high':
        return { fontWeight: '600' as const };
      case 'medium':
        return { fontWeight: '400' as const };
      case 'low':
        return { fontWeight: '300' as const, fontSize: 14 };
      default:
        return { fontWeight: '400' as const };
    }
  }, [task.energyLevel]);

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
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const s = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0.5, 1],
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

  // ── Labels ────────────────────────────────────────────────────────────
  const leftLabel = !task.startedAt && !task.isCompleted && onStart ? 'START' : 'DEFER';
  const rightLabel = isOverdue && onRevive ? 'REVIVE' : isInProgress ? 'COMPLETE' : 'DONE';

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(250)}
      style={[styles.outerContainer, { opacity }]}
    >
      {/* Left action background (revealed on swipe right) */}
      <View style={styles.leftActionBg}>
        <Animated.Text style={[styles.swipeActionText, leftActionStyle]}>
          {leftLabel}
        </Animated.Text>
      </View>

      {/* Right action background (revealed on swipe left) */}
      <View style={styles.rightActionBg}>
        <Animated.Text style={[styles.swipeActionText, rightActionStyle]}>
          {rightLabel}
        </Animated.Text>
      </View>

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
                checked={task.isCompleted}
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
                  energyStyle,
                  task.isCompleted && styles.titleCompleted,
                  hasChildren && styles.titleParent,
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
    </Animated.View>
  );
});

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  container: {
    backgroundColor: Colors.white,
    zIndex: 2,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
    paddingLeft: 0,
    minHeight: 52,
  },
  leftActionBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gray800,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 24,
    zIndex: 1,
  },
  rightActionBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
    zIndex: 1,
  },
  swipeActionText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  priorityBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: Spacing.md,
    borderRadius: 0,
  },
  checkboxContainer: {
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    ...Typography.body,
    color: Colors.text,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.gray500,
  },
  titleParent: {
    fontWeight: '500',
  },
  description: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  timingText: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
  },
  deadlineTag: {
    ...Typography.small,
    color: Colors.textTertiary,
  },
  overdueTagGentle: {
    ...Typography.small,
    color: Colors.gray400,
  },
  completedTag: {
    ...Typography.small,
    color: Colors.gray400,
  },
  deferBadge: {
    ...Typography.small,
    color: Colors.gray400,
    marginLeft: Spacing.xs,
  },
  connectorVertical: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  connectorHorizontal: {
    position: 'absolute',
    width: 8,
    height: 1,
    backgroundColor: '#E0E0E0',
    top: '50%',
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
