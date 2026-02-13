import React, { memo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  I18nManager,
} from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Task, Priority } from '../types';
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatDeadline, formatCompletedDate, daysFromNow } from '../utils/dateUtils';

interface TaskItemProps {
  task: Task;
  onPress: (task: Task) => void;
  onComplete: (id: string) => void;
  onDefer: (id: string) => void;
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
}: TaskItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handlePress = useCallback(() => {
    onPress(task);
  }, [task, onPress]);

  const handleCheckboxPress = useCallback(() => {
    onComplete(task.id);
  }, [task.id, onComplete]);

  const renderLeftActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [0, 80],
        outputRange: [0.5, 1],
        extrapolate: 'clamp',
      });
      return (
        <RectButton style={styles.swipeActionLeft} onPress={() => {}}>
          <Animated.Text style={[styles.swipeActionText, { transform: [{ scale }] }]}>
            DONE
          </Animated.Text>
        </RectButton>
      );
    },
    [],
  );

  const renderRightActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0.5],
        extrapolate: 'clamp',
      });
      return (
        <RectButton style={styles.swipeActionRight} onPress={() => {}}>
          <Animated.Text style={[styles.swipeActionText, { transform: [{ scale }] }]}>
            DEFER
          </Animated.Text>
        </RectButton>
      );
    },
    [],
  );

  const handleSwipeOpen = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        // Left actions opened = user swiped right = COMPLETE
        onComplete(task.id);
      } else {
        // Right actions opened = user swiped left = DEFER
        onDefer(task.id);
      }
      setTimeout(() => swipeableRef.current?.close(), 100);
    },
    [task.id, onComplete, onDefer],
  );

  const isOverdue = task.deadline ? daysFromNow(task.deadline) < 0 : false;

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
        style={styles.container}
        onPress={handlePress}
        android_ripple={{ color: Colors.gray100 }}>
        {/* Priority indicator bar */}
        <View
          style={[
            styles.priorityBar,
            { backgroundColor: PRIORITY_COLORS[task.priority] },
          ]}
        />

        {/* Checkbox */}
        <Pressable
          style={[
            styles.checkbox,
            task.isCompleted && styles.checkboxCompleted,
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
              task.isCompleted && styles.titleCompleted,
            ]}
            numberOfLines={1}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {task.description}
            </Text>
          ) : null}
        </View>

        {/* Deadline/Status tag */}
        {task.isCompleted && task.completedAt ? (
          <Text style={styles.completedTag}>
            {formatCompletedDate(task.completedAt)}
          </Text>
        ) : task.deadline ? (
          <Text style={[styles.deadlineTag, isOverdue && styles.deadlineOverdue]}>
            {formatDeadline(task.deadline)}
          </Text>
        ) : null}

        {/* Defer count indicator */}
        {task.deferCount > 0 && !task.isCompleted ? (
          <Text style={styles.deferBadge}>{task.deferCount}×</Text>
        ) : null}
      </Pressable>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
    paddingLeft: 0,
    backgroundColor: Colors.white,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
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
  deadlineTag: {
    ...Typography.small,
    color: Colors.textTertiary,
  },
  deadlineOverdue: {
    color: Colors.gray800,
    fontWeight: '600',
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
  swipeActionRight: {
    backgroundColor: Colors.gray800,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xxl,
    width: 100,
  },
  swipeActionText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
