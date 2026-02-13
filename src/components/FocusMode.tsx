import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task, Priority } from '../types';
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatDeadline } from '../utils/dateUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FocusModeProps {
  visible: boolean;
  tasks: Task[];
  onComplete: (id: string) => void;
  onExit: () => void;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#22C55E',
  none: '#9E9E9E',
};

/**
 * Feature 9: Pull-to-Focus Mode
 * 
 * Full-screen view of next 3 tasks, one at a time, swipe to advance.
 * Black text on white background, maximum whitespace, only essential info.
 * 200ms fade transition, 48pt time at top.
 */
export const FocusMode = memo(function FocusMode({
  visible,
  tasks,
  onComplete,
  onExit,
}: FocusModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const focusTasks = tasks.slice(0, 3);
  const currentTask = focusTasks[currentIndex];

  // Reset index when tasks change
  useEffect(() => {
    setCurrentIndex(0);
  }, [tasks.length]);

  // Fade in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  const handleComplete = useCallback(() => {
    if (!currentTask) return;
    onComplete(currentTask.id);
    // Auto-advance
    if (currentIndex < focusTasks.length - 1) {
      // Slide animation
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentIndex(prev => prev + 1);
    } else {
      // All done
      onExit();
    }
  }, [currentTask, currentIndex, focusTasks.length, onComplete, onExit, slideAnim]);

  const handleNext = useCallback(() => {
    if (currentIndex < focusTasks.length - 1) {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, focusTasks.length, slideAnim]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, slideAnim]);

  if (!visible) return null;

  // Format current time
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (focusTasks.length === 0) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.emptyFocusContainer}>
          <Icon name="checkmark-done-circle" size={64} color="#22C55E" />
          <Text style={styles.emptyTitle}>All clear!</Text>
          <Text style={styles.emptySubtitle}>No tasks need your attention right now.</Text>
          <Pressable style={styles.exitButton} onPress={onExit}>
            <Text style={styles.exitText}>Back to list</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Time display */}
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{timeString}</Text>
      </View>

      {/* Progress dots */}
      <View style={styles.progressDots}>
        {focusTasks.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
              i < currentIndex && styles.dotCompleted,
            ]}
          />
        ))}
      </View>

      {/* Task card */}
      <Animated.View
        style={[
          styles.taskCardContainer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {currentTask && (
          <View style={styles.taskCard}>
            {/* Priority indicator */}
            <View style={styles.priorityRow}>
              <Icon
                name={currentTask.priority === 'high' ? 'flag' : 'flag-outline'}
                size={14}
                color={PRIORITY_COLORS[currentTask.priority]}
              />
              <Text style={[styles.priorityLabel, { color: PRIORITY_COLORS[currentTask.priority] }]}>
                {currentTask.priority.charAt(0).toUpperCase() + currentTask.priority.slice(1)} priority
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.taskTitle}>{currentTask.title}</Text>

            {/* Description */}
            {currentTask.description ? (
              <Text style={styles.taskDescription}>{currentTask.description}</Text>
            ) : null}

            {/* Deadline */}
            {currentTask.deadline && (
              <View style={styles.deadlineRow}>
                <Icon name="time-outline" size={16} color={Colors.gray500} />
                <Text style={styles.deadlineText}>
                  {formatDeadline(currentTask.deadline)}
                </Text>
              </View>
            )}

            {/* Estimate */}
            {currentTask.estimatedMinutes && (
              <View style={styles.deadlineRow}>
                <Icon name="hourglass-outline" size={16} color={Colors.gray500} />
                <Text style={styles.deadlineText}>
                  ~{currentTask.estimatedMinutes} min
                </Text>
              </View>
            )}

            {/* Complete button */}
            <Pressable style={styles.completeButton} onPress={handleComplete}>
              <Icon name="checkmark-circle-outline" size={20} color={Colors.white} />
              <Text style={styles.completeText}>Mark Complete</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* Navigation */}
      <View style={styles.navigationRow}>
        <Pressable
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <Icon name="chevron-back" size={20} color={currentIndex === 0 ? Colors.gray200 : Colors.gray600} />
        </Pressable>

        <Text style={styles.positionText}>
          {currentIndex + 1} of {focusTasks.length}
        </Text>

        <Pressable
          style={[styles.navButton, currentIndex >= focusTasks.length - 1 && styles.navButtonDisabled]}
          onPress={handleNext}
          disabled={currentIndex >= focusTasks.length - 1}
        >
          <Icon name="chevron-forward" size={20} color={currentIndex >= focusTasks.length - 1 ? Colors.gray200 : Colors.gray600} />
        </Pressable>
      </View>

      {/* Exit */}
      <Pressable style={styles.exitButton} onPress={onExit}>
        <Icon name="close-outline" size={16} color={Colors.gray500} />
        <Text style={styles.exitText}>Exit Focus Mode</Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 100,
  },
  timeContainer: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: -2,
    color: Colors.text,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    top: 150,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray200,
  },
  dotActive: {
    backgroundColor: Colors.black,
    width: 24,
  },
  dotCompleted: {
    backgroundColor: '#22C55E',
  },
  taskCardContainer: {
    width: '100%',
  },
  taskCard: {
    width: '100%',
    padding: 24,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  priorityLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.text,
    lineHeight: 32,
    marginBottom: 12,
  },
  taskDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  deadlineText: {
    fontSize: 14,
    color: Colors.gray500,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.black,
    height: 48,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  completeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    position: 'absolute',
    bottom: 120,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  positionText: {
    fontSize: 13,
    color: Colors.gray500,
  },
  exitButton: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  exitText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray500,
  },
  emptyFocusContainer: {
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: 'center',
  },
});
