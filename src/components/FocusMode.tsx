import React, { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolate,
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
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { formatDeadline } from '../utils/dateUtils';
import { AnimatedPressable } from './ui';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY } from '../utils/animations';

import { isTaskLocked, getChildren } from '../utils/dependencyChains';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FocusModeProps {
    tasks: Task[];
    allTasks: Task[];
    onComplete: (id: string) => void;
    onCompleteSubtask: (id: string) => void;
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
    tasks,
    allTasks,
    onComplete,
    onCompleteSubtask,
    onExit,
}: FocusModeProps) {
    const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [currentIndex, setCurrentIndex] = useState(0);
    // Direction: 'next' | 'prev' for card transition
    const [direction, setDirection] = useState<'next' | 'prev'>('next');
    // Key to force re-mount of card for entering/exiting animations
    const [cardKey, setCardKey] = useState(0);
    // Shake feedback for locked attempt
    const lockShake = useSharedValue(0);

    const focusTasks = tasks.slice(0, 3);
    const currentTask = focusTasks[currentIndex];

    // Compute lock state for current task
    const isLocked = useMemo(() => {
        if (!currentTask) return false;
        return isTaskLocked(currentTask, allTasks);
    }, [currentTask, allTasks]);

    // Get children for current task
    const children = useMemo(() => {
        if (!currentTask) return [];
        return getChildren(currentTask, allTasks);
    }, [currentTask, allTasks]);

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
        // Parent-child lock check: can't complete parent with incomplete children
        if (isLocked) {
            haptic('warning');
            // Shake the card and reveal subtask checklist
            lockShake.value = withSpring(1, SPRING_SNAPPY, () => {
                lockShake.value = withSpring(0, SPRING_SNAPPY);
            });
            return;
        }
        haptic('success');
        onComplete(currentTask.id);
        if (currentIndex < focusTasks.length - 1) {
            advanceCard('next', currentIndex + 1);
        } else {
            onExit();
        }
    }, [currentTask, currentIndex, focusTasks.length, onComplete, onExit, advanceCard, isLocked, lockShake]);

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

    // Animated shake style for locked card
    const lockShakeStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            lockShake.value,
            [0, 0.25, 0.5, 0.75, 1],
            [0, -8, 8, -4, 0],
        );
        return { transform: [{ translateX }] };
    });

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

    // Subtask progress stats
    const completedChildren = children.filter(c => c.isCompleted).length;
    const totalChildren = children.length;
    const hasChildren = totalChildren > 0;

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

            {/* Spacer to push content down from top items */}
            <View style={styles.topSpacer} />

            {/* Task card – keyed to force re-mount with animation */}
            <Animated.View
                key={cardKey}
                entering={entering}
                exiting={exiting}
                style={styles.taskCardContainer}>
                {currentTask && (
                    <Animated.View style={[styles.taskCard, lockShakeStyle]}>
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
                            {/* Lock badge for parent tasks */}
                            {isLocked && (
                                <View style={styles.lockBadge}>
                                    <Icon name="lock-closed" size={11} color="rgba(255,255,255,0.6)" />
                                </View>
                            )}
                        </View>

                        {/* Title */}
                        <Text style={styles.taskTitle}>{currentTask.title}</Text>

                        {/* Description */}
                        {currentTask.description ? (
                            <Text style={styles.taskDescription}>
                                {currentTask.description}
                            </Text>
                        ) : null}

                        {/* Subtask progress bar (always visible if task has children) */}
                        {hasChildren && (
                            <View style={styles.subtaskProgressSection}>
                                <View style={styles.subtaskProgressHeader}>
                                    <Icon name="git-branch-outline" size={14} color="rgba(255,255,255,0.5)" />
                                    <Text style={styles.subtaskProgressText}>
                                        {completedChildren}/{totalChildren} subtask{totalChildren !== 1 ? 's' : ''} done
                                    </Text>
                                </View>
                                <View style={styles.subtaskProgressTrack}>
                                    <View
                                        style={[
                                            styles.subtaskProgressFill,
                                            { width: `${totalChildren > 0 ? (completedChildren / totalChildren) * 100 : 0}%` },
                                            completedChildren === totalChildren && styles.subtaskProgressComplete,
                                        ]}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Subtask checklist (always visible, tappable to complete) */}
                        {hasChildren && (
                            <View style={styles.subtaskChecklist}>
                                <Text style={styles.subtaskChecklistTitle}>
                                    Subtasks
                                </Text>
                                <ScrollView
                                    style={styles.subtaskScrollView}
                                    nestedScrollEnabled
                                    showsVerticalScrollIndicator={false}>
                                    {children.map(child => (
                                        <AnimatedPressable
                                            key={child.id}
                                            onPress={() => {
                                                if (!child.isCompleted) {
                                                    haptic('success');
                                                    onCompleteSubtask(child.id);
                                                }
                                            }}
                                            disabled={child.isCompleted}
                                            hapticStyle={null}>
                                            <View style={styles.subtaskRow}>
                                                <View style={[
                                                    styles.subtaskCheckbox,
                                                    child.isCompleted && styles.subtaskCheckboxDone,
                                                ]}>
                                                    {child.isCompleted && (
                                                        <Icon name="checkmark" size={10} color={colors.surfaceDark} />
                                                    )}
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.subtaskName,
                                                        child.isCompleted && styles.subtaskNameDone,
                                                    ]}
                                                    numberOfLines={1}>
                                                    {child.title}
                                                </Text>
                                                {child.isCompleted ? (
                                                    <Icon name="checkmark-circle" size={14} color="#22C55E" />
                                                ) : (
                                                    <Icon name="ellipse-outline" size={14} color="rgba(255,255,255,0.25)" />
                                                )}
                                            </View>
                                        </AnimatedPressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Deadline */}
                        {currentTask.deadline && (
                            <View style={styles.deadlineRow}>
                                <Icon name="time-outline" size={16} color={colors.gray500} />
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
                                    color={colors.gray500}
                                />
                                <Text style={styles.deadlineText}>
                                    ~{currentTask.estimatedMinutes} min
                                </Text>
                            </View>
                        )}

                        {/* Complete button */}
                        <AnimatedPressable
                            onPress={handleComplete}
                            hapticStyle={isLocked ? null : 'success'}
                            pressScale={0.95}>
                            <View style={[
                                styles.completeButton,
                                isLocked && styles.completeButtonLocked,
                            ]}>
                                <Icon
                                    name={isLocked ? 'lock-closed' : 'checkmark-circle-outline'}
                                    size={20}
                                    color={isLocked ? 'rgba(255,255,255,0.4)' : colors.surfaceDark}
                                />
                                <Text style={[
                                    styles.completeText,
                                    isLocked && styles.completeTextLocked,
                                ]}>
                                    {isLocked ? 'Finish Subtasks First' : 'Mark Complete'}
                                </Text>
                            </View>
                        </AnimatedPressable>
                    </Animated.View>
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
                            color={currentIndex === 0 ? 'rgba(255,255,255,0.2)' : colors.white}
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
                                    : colors.white
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: c.surfaceDark,
        alignItems: 'center',
        paddingHorizontal: 32,
        zIndex: 100,
    },
    topSpacer: {
        flex: 0.6,
    },
    timeContainer: {
        marginTop: 80,
        alignSelf: 'center',
    },
    timeText: {
        fontSize: 48,
        fontWeight: '200',
        letterSpacing: -2,
        color: c.white,
    fontFamily: FontFamily,
    },
    progressDots: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dotActive: {
        backgroundColor: c.white,
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
    fontFamily: FontFamily,
    },
    taskTitle: {
        fontSize: 26,
        fontWeight: '700',
        letterSpacing: -0.5,
        color: c.white,
        lineHeight: 34,
        marginBottom: 12,
    fontFamily: FontFamily,
    },
    taskDescription: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 22,
        marginBottom: 16,
    fontFamily: FontFamily,
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
    fontFamily: FontFamily,
    },
    completeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.white,
        height: 52,
        borderRadius: BorderRadius.button,
        marginTop: 28,
        gap: 8,
    },
    completeButtonLocked: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    completeText: {
        fontSize: 16,
        fontWeight: '700',
        color: c.surfaceDark,
    fontFamily: FontFamily,
    },
    completeTextLocked: {
        color: 'rgba(255,255,255,0.4)',
    },
    lockBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 'auto',
    },
    subtaskProgressSection: {
        marginBottom: 16,
        gap: 6,
    },
    subtaskProgressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    subtaskProgressText: {
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: FontFamily,
    },
    subtaskProgressTrack: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 1.5,
        overflow: 'hidden',
    },
    subtaskProgressFill: {
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 1.5,
    },
    subtaskProgressComplete: {
        backgroundColor: '#22C55E',
    },
    subtaskChecklist: {
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    subtaskChecklistTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 8,
        fontFamily: FontFamily,
    },
    subtaskScrollView: {
        maxHeight: 120,
    },
    subtaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 5,
    },
    subtaskCheckbox: {
        width: 16,
        height: 16,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    subtaskCheckboxDone: {
        backgroundColor: '#22C55E',
        borderColor: '#22C55E',
    },
    subtaskName: {
        flex: 1,
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: FontFamily,
    },
    subtaskNameDone: {
        textDecorationLine: 'line-through',
        color: 'rgba(255,255,255,0.35)',
    },
    navigationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        marginTop: 32,
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
    fontFamily: FontFamily,
    },
    exitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: BorderRadius.pill,
        marginTop: 20,
        marginBottom: 60,
        alignSelf: 'center',
    },
    exitText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    fontFamily: FontFamily,
    },
    emptyFocusContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: c.white,
    fontFamily: FontFamily,
    },
    emptySubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
    fontFamily: FontFamily,
    },
});
