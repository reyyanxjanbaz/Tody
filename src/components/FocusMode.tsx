import React, { memo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withSequence,
    FadeIn,
    FadeInDown,
    FadeOut,
    SlideInRight,
    SlideOutLeft,
    SlideInLeft,
    SlideOutRight,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task, Priority } from '../types';
import { Colors, Spacing, Typography, BorderRadius } from '../utils/colors';
import { formatDeadline } from '../utils/dateUtils';
import { AnimatedPressable } from './ui';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY } from '../utils/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
 * Feature 9: Pull-to-Focus Mode (Reanimated 3)
 *
 * Full-screen view of next 3 tasks, one at a time.
 * Spring-based slide transitions, haptic on complete.
 */
export const FocusMode = memo(function FocusMode({
    visible,
    tasks,
    onComplete,
    onExit,
}: FocusModeProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    // Direction: 'next' | 'prev' for card transition
    const [direction, setDirection] = useState<'next' | 'prev'>('next');
    // Key to force re-mount of card for entering/exiting animations
    const [cardKey, setCardKey] = useState(0);

    const focusTasks = tasks.slice(0, 3);
    const currentTask = focusTasks[currentIndex];

    // Animated dot width for active indicator
    const activeDot = useSharedValue(currentIndex);
    useEffect(() => {
        activeDot.value = withSpring(currentIndex, SPRING_SNAPPY);
    }, [currentIndex, activeDot]);

    // Reset index when tasks change
    useEffect(() => {
        setCurrentIndex(0);
        setCardKey(k => k + 1);
    }, [tasks.length]);

    const advanceCard = useCallback(
        (dir: 'next' | 'prev', nextIndex: number) => {
            setDirection(dir);
            setCardKey(k => k + 1);
            setCurrentIndex(nextIndex);
        },
        [],
    );

    const handleComplete = useCallback(() => {
        if (!currentTask) return;
        haptic('success');
        onComplete(currentTask.id);
        if (currentIndex < focusTasks.length - 1) {
            advanceCard('next', currentIndex + 1);
        } else {
            onExit();
        }
    }, [currentTask, currentIndex, focusTasks.length, onComplete, onExit, advanceCard]);

    const handleNext = useCallback(() => {
        if (currentIndex < focusTasks.length - 1) {
            haptic('light');
            advanceCard('next', currentIndex + 1);
        }
    }, [currentIndex, focusTasks.length, advanceCard]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            haptic('light');
            advanceCard('prev', currentIndex - 1);
        }
    }, [currentIndex, advanceCard]);

    if (!visible) return null;

    // Format current time
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (focusTasks.length === 0) {
        return (
            <Animated.View
                entering={FadeIn.duration(250)}
                exiting={FadeOut.duration(200)}
                style={styles.container}>
                <Animated.View
                    entering={FadeInDown.delay(100).duration(300)}
                    style={styles.emptyFocusContainer}>
                    <Icon name="checkmark-done-circle" size={64} color="#22C55E" />
                    <Text style={styles.emptyTitle}>All clear!</Text>
                    <Text style={styles.emptySubtitle}>
                        No tasks need your attention right now.
                    </Text>
                    <AnimatedPressable onPress={onExit} hapticStyle="light">
                        <View style={styles.exitButton}>
                            <Text style={styles.exitText}>Back to list</Text>
                        </View>
                    </AnimatedPressable>
                </Animated.View>
            </Animated.View>
        );
    }

    // Choose entering/exiting based on direction
    const entering =
        direction === 'next'
            ? SlideInRight.duration(300)
            : SlideInLeft.duration(300);
    const exiting =
        direction === 'next'
            ? SlideOutLeft.duration(250)
            : SlideOutRight.duration(250);

    return (
        <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(200)}
            style={styles.container}>
            {/* Time display */}
            <Animated.View
                entering={FadeInDown.duration(350)}
                style={styles.timeContainer}>
                <Text style={styles.timeText}>{timeString}</Text>
            </Animated.View>

            {/* Progress dots */}
            <View style={styles.progressDots}>
                {focusTasks.map((_, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.dot,
                            i === currentIndex && styles.dotActive,
                            i < currentIndex && styles.dotCompleted,
                        ]}
                    />
                ))}
            </View>

            {/* Task card – keyed to force re-mount with animation */}
            <Animated.View
                key={cardKey}
                entering={entering}
                exiting={exiting}
                style={styles.taskCardContainer}>
                {currentTask && (
                    <View style={styles.taskCard}>
                        {/* Priority indicator */}
                        <View style={styles.priorityRow}>
                            <Icon
                                name={
                                    currentTask.priority === 'high' ? 'flag' : 'flag-outline'
                                }
                                size={14}
                                color={PRIORITY_COLORS[currentTask.priority]}
                            />
                            <Text
                                style={[
                                    styles.priorityLabel,
                                    { color: PRIORITY_COLORS[currentTask.priority] },
                                ]}>
                                {currentTask.priority.charAt(0).toUpperCase() +
                                    currentTask.priority.slice(1)}{' '}
                                priority
                            </Text>
                        </View>

                        {/* Title */}
                        <Text style={styles.taskTitle}>{currentTask.title}</Text>

                        {/* Description */}
                        {currentTask.description ? (
                            <Text style={styles.taskDescription}>
                                {currentTask.description}
                            </Text>
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
                                <Icon
                                    name="hourglass-outline"
                                    size={16}
                                    color={Colors.gray500}
                                />
                                <Text style={styles.deadlineText}>
                                    ~{currentTask.estimatedMinutes} min
                                </Text>
                            </View>
                        )}

                        {/* Complete button */}
                        <AnimatedPressable
                            onPress={handleComplete}
                            hapticStyle="success"
                            pressScale={0.95}>
                            <View style={styles.completeButton}>
                                <Icon
                                    name="checkmark-circle-outline"
                                    size={20}
                                    color={Colors.white}
                                />
                                <Text style={styles.completeText}>Mark Complete</Text>
                            </View>
                        </AnimatedPressable>
                    </View>
                )}
            </Animated.View>

            {/* Navigation */}
            <View style={styles.navigationRow}>
                <AnimatedPressable
                    onPress={handlePrev}
                    disabled={currentIndex === 0}
                    hapticStyle="selection">
                    <View
                        style={[
                            styles.navButton,
                            currentIndex === 0 && styles.navButtonDisabled,
                        ]}>
                        <Icon
                            name="chevron-back"
                            size={20}
                            color={currentIndex === 0 ? 'rgba(255,255,255,0.2)' : Colors.white}
                        />
                    </View>
                </AnimatedPressable>

                <Text style={styles.positionText}>
                    {currentIndex + 1} of {focusTasks.length}
                </Text>

                <AnimatedPressable
                    onPress={handleNext}
                    disabled={currentIndex >= focusTasks.length - 1}
                    hapticStyle="selection">
                    <View
                        style={[
                            styles.navButton,
                            currentIndex >= focusTasks.length - 1 &&
                            styles.navButtonDisabled,
                        ]}>
                        <Icon
                            name="chevron-forward"
                            size={20}
                            color={
                                currentIndex >= focusTasks.length - 1
                                    ? 'rgba(255,255,255,0.2)'
                                    : Colors.white
                            }
                        />
                    </View>
                </AnimatedPressable>
            </View>

            {/* Exit */}
            <AnimatedPressable onPress={onExit} hapticStyle="light">
                <View style={styles.exitButton}>
                    <Icon name="close-outline" size={16} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.exitText}>Exit Focus Mode</Text>
                </View>
            </AnimatedPressable>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.surfaceDark,
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
        color: Colors.white,
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
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dotActive: {
        backgroundColor: Colors.white,
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
        padding: 28,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: BorderRadius.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    priorityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    priorityLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    taskTitle: {
        fontSize: 26,
        fontWeight: '700',
        letterSpacing: -0.5,
        color: Colors.white,
        lineHeight: 34,
        marginBottom: 12,
    },
    taskDescription: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
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
        color: 'rgba(255,255,255,0.5)',
    },
    completeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.white,
        height: 52,
        borderRadius: BorderRadius.button,
        marginTop: 28,
        gap: 8,
    },
    completeText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.surfaceDark,
    },
    navigationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        position: 'absolute',
        bottom: 120,
    },
    navButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonDisabled: {
        opacity: 0.3,
    },
    positionText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
    },
    exitButton: {
        position: 'absolute',
        bottom: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: BorderRadius.pill,
    },
    exitText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    emptyFocusContainer: {
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.white,
    },
    emptySubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
    },
});
