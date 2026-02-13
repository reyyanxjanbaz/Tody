import React, { memo, useCallback, useRef, useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  I18nManager,
  Alert,
  Platform,
} from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Task, Priority } from '../types';
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatDeadline, formatCompletedDate, daysFromNow } from '../utils/dateUtils';
import { getTaskOpacity, formatOverdueGently } from '../utils/decay';
import { formatMinutes, getElapsedMinutes, isUnreasonableDuration } from '../utils/timeTracking';
import { recordSwipeAction } from '../utils/swipeMemory';

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

const PRIORITY_COLORS: Record<Priority, string> = {
  high: Colors.black,
  medium: Colors.gray500,
  low: Colors.gray200,
  none: 'transparent',
};

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
  const swipeableRef = useRef<Swipeable>(null);

  // Shake animation for locked tasks
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Highlight animation for child pulse
  const highlightAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for tasks in progress
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isInProgress = !!task.startedAt && !task.isCompleted;

  useEffect(() => {
    if (isInProgress) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.95,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isInProgress, pulseAnim]);

  // Compute opacity based on overdue decay
  const opacity = useMemo(() => getTaskOpacity(task), [task]);
  const overdueLabel = useMemo(() => formatOverdueGently(task), [task]);
  const isOverdue = task.deadline ? daysFromNow(task.deadline) < 0 : false;

  const energyStyle = useMemo(() => {
    switch (task.energyLevel) {
      case 'high':
        return { fontWeight: '600' as const };
      case 'medium':
        return { fontWeight: '400' as const };
      case 'low':
        return { fontWeight: '300' as const, fontSize: 14 };
      default:
        // Default to medium if undefined (migration case)
        return { fontWeight: '400' as const };
    }
  }, [task.energyLevel]);

  const handlePress = useCallback(() => {
    onPress(task);
  }, [task, onPress]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 5, duration: 33, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 33, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 33, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 33, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 33, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Child highlight pulse effect
  useEffect(() => {
    if (childHighlight) {
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 0.6, duration: 100, useNativeDriver: true }),
        Animated.timing(highlightAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [childHighlight, highlightAnim]);

  const handleCheckboxPress = useCallback(() => {
    if (isLocked) {
      triggerShake();
      return;
    }
    onComplete(task.id);
  }, [task.id, onComplete, isLocked, triggerShake]);

  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      onLongPress(task);
    }
  }, [task, onLongPress]);

  const renderRightActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0.5],
        extrapolate: 'clamp',
      });

      // Show START for unstarted tasks, DEFER for others
      const label = !task.startedAt && !task.isCompleted && onStart ? 'START' : 'DEFER';

      return (
        <View style={styles.swipeRightContainer}>
          <RectButton style={styles.swipeActionRight} onPress={() => {}}>
            <Animated.Text style={[styles.swipeActionText, { transform: [{ scale }] }]}>
              {label}
            </Animated.Text>
          </RectButton>
        </View>
      );
    },
    [task.startedAt, task.isCompleted, onStart],
  );

  const renderLeftActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [0, 80],
        outputRange: [0.5, 1],
        extrapolate: 'clamp',
      });

      // Show SUBTASK on left swipe (right direction), REVIVE for overdue, COMPLETE for in-progress, DONE otherwise
      if (onAddSubtask && !task.isCompleted && task.depth < 3) {
        return (
          <RectButton style={styles.swipeActionSubtask} onPress={() => {}}>
            <Animated.Text style={[styles.swipeActionText, { transform: [{ scale }] }]}>
              SUBTASK
            </Animated.Text>
          </RectButton>
        );
      }

      const label = isOverdue && onRevive ? 'REVIVE' : isInProgress ? 'COMPLETE' : 'DONE';

      return (
        <RectButton style={styles.swipeActionLeft} onPress={() => {}}>
          <Animated.Text style={[styles.swipeActionText, { transform: [{ scale }] }]}>
            {label}
          </Animated.Text>
        </RectButton>
      );
    },
    [isOverdue, onRevive, isInProgress, onAddSubtask, task.isCompleted, task.depth],
  );

  const handleSwipeOpen = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        // Left actions opened = user swiped right
        if (onAddSubtask && !task.isCompleted && task.depth < 3) {
          recordSwipeAction('subtask');
          onAddSubtask(task);
        } else if (isOverdue && onRevive) {
          recordSwipeAction('revive');
          onRevive(task.id);
        } else if (isInProgress && onCompleteTimed) {
          // Complete a timed task
          const elapsed = getElapsedMinutes(task.startedAt!);
          if (isUnreasonableDuration(elapsed)) {
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
            onCompleteTimed(task.id);
          }
        } else {
          recordSwipeAction('complete');
          onComplete(task.id);
        }
      } else {
        // Right actions opened = user swiped left
        if (!task.startedAt && !task.isCompleted && onStart) {
          recordSwipeAction('start');
          onStart(task.id);
        } else {
          recordSwipeAction('defer');
          onDefer(task.id);
        }
      }
      setTimeout(() => swipeableRef.current?.close(), 100);
    },
    [task.id, task.startedAt, task.isCompleted, task.depth, onComplete, onDefer, onRevive, onStart, onCompleteTimed, onAddSubtask, isOverdue, isInProgress],
  );

  const indentation = (task.depth || 0) * 16;
  const hasChildren = task.childIds && task.childIds.length > 0;

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      overshootLeft={false}
      overshootRight={false}
      enabled={!task.isCompleted}>
      <Pressable
        style={[styles.container, { opacity }]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        android_ripple={{ color: Colors.gray100 }}>
        <Animated.View
          style={[
            styles.innerContainer,
            {
              opacity: childHighlight ? highlightAnim : isInProgress ? pulseAnim : 1,
              transform: [{ translateX: shakeAnim }],
              paddingLeft: indentation,
            },
          ]}>
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
              style={[
                styles.connectorHorizontal,
                { left: indentation - 8 },
              ]}
            />
          )}

          {/* Priority indicator bar */}
          <View
            style={[
              styles.priorityBar,
              { backgroundColor: PRIORITY_COLORS[task.priority] },
            ]}
          />

          {/* Lock icon for locked parents */}
          {isLocked && (
            <View style={styles.lockIcon}>
              <Text style={styles.lockIconText}>🔒</Text>
            </View>
          )}

          {/* Checkbox */}
          <Pressable
            style={[
              styles.checkbox,
              task.isCompleted && styles.checkboxCompleted,
              isLocked && styles.checkboxLocked,
            ]}
            onPress={handleCheckboxPress}
            hitSlop={12}>
            {task.isCompleted && <View style={styles.checkboxInner} />}
          </Pressable>

          {/* Content */}
          <View style={styles.content}>
            <Text
              style={[
                styles.title,
                energyStyle,
                task.isCompleted && styles.titleCompleted,
                hasChildren && styles.titleParent,
              ]}
              numberOfLines={1}>
              {task.title}
            </Text>
            {task.description ? (
              <Text style={styles.description} numberOfLines={1}>
                {task.description}
              </Text>
            ) : null}
            {/* Timing info */}
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

          {/* Deadline/Status tag */}
          {task.isCompleted && task.completedAt ? (
            <Text style={styles.completedTag}>
              {formatCompletedDate(task.completedAt)}
            </Text>
          ) : isOverdue && overdueLabel ? (
            <Text style={styles.overdueTagGentle}>
              {overdueLabel}
            </Text>
          ) : task.deadline ? (
            <Text style={styles.deadlineTag}>
              {formatDeadline(task.deadline)}
            </Text>
          ) : null}

          {/* Defer count indicator */}
          {task.deferCount > 0 && !task.isCompleted ? (
            <Text style={styles.deferBadge}>{task.deferCount}×</Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
    paddingLeft: 0,
    minHeight: 52,
  },
  priorityBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: Spacing.md,
    borderRadius: 0,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: Colors.gray400,
    borderRadius: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  checkboxCompleted: {
    borderColor: Colors.black,
    backgroundColor: Colors.black,
  },
  checkboxInner: {
    width: 8,
    height: 8,
    backgroundColor: Colors.white,
    borderRadius: 0,
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
  swipeActionLeft: {
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xxl,
    width: 100,
  },
  swipeActionSubtask: {
    backgroundColor: Colors.gray600,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xxl,
    width: 100,
  },
  swipeActionRight: {
    backgroundColor: Colors.gray800,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xxl,
    width: 100,
  },
  swipeRightContainer: {
    flexDirection: 'row',
  },
  swipeActionText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  // Dependency chains styles
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
  checkboxLocked: {
    borderColor: Colors.gray200,
  },
  titleParent: {
    fontWeight: '500',
  },
});
