/**
 * ParameterPills — Tap-to-cycle task parameter controls.
 *
 * Design philosophy: Every parameter is a single tappable pill.
 * No typing. No dropdowns. No modals. Just tap to cycle.
 *
 * Each pill shows the current value with a color-coded border
 * and tinted background. One tap advances to the next value
 * with haptic feedback. It feels physical — like clicking a dial.
 *
 * Components:
 *   PriorityPill  → cycles none → low → medium → high
 *   EnergyPill    → cycles low → medium → high
 *   EstimatePill  → reveals TimeQuickPick row
 *   DeadlinePill  → triggers deadline picker
 *   TimeQuickPick → 6 preset durations, one-tap select
 *   PropertyRow   → icon + label + tappable value (for detail screen)
 */

import React, { memo, useCallback, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography } from '../utils/colors';
import { Priority, EnergyLevel } from '../types';
import { haptic } from '../utils/haptics';
import { formatMinutes } from '../utils/timeTracking';
import { SPRING_SNAPPY } from '../utils/animations';

// ── Priority ────────────────────────────────────────────────────────────────

const PRIORITY_CYCLE: Priority[] = ['none', 'low', 'medium', 'high'];
const PRIORITY_DISPLAY: Record<Priority, { label: string; icon: string; color: string }> = {
    none: { label: 'Priority', icon: 'remove-outline', color: Colors.gray400 },
    low: { label: 'Low', icon: 'flag-outline', color: '#22C55E' },
    medium: { label: 'Medium', icon: 'flag-outline', color: '#F59E0B' },
    high: { label: 'High', icon: 'flag', color: '#EF4444' },
};

interface PriorityPillProps {
    value: Priority;
    onChange: (value: Priority) => void;
}

export const PriorityPill = memo(function PriorityPill({ value, onChange }: PriorityPillProps) {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const handleTap = useCallback(() => {
        haptic('selection');
        scale.value = withSpring(0.9, SPRING_SNAPPY);
        setTimeout(() => { scale.value = withSpring(1, SPRING_SNAPPY); }, 80);
        const idx = PRIORITY_CYCLE.indexOf(value);
        onChange(PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]);
    }, [value, onChange, scale]);

    const d = PRIORITY_DISPLAY[value];
    const isActive = value !== 'none';

    return (
        <Pressable onPress={handleTap}>
            <Animated.View
                style={[
                    styles.pill,
                    isActive && { borderColor: d.color, backgroundColor: d.color + '14' },
                    animStyle,
                ]}>
                <Icon name={d.icon} size={13} color={d.color} />
                <Text style={[styles.pillText, isActive && { color: d.color, fontWeight: '600' }]}>
                    {d.label}
                </Text>
            </Animated.View>
        </Pressable>
    );
});

// ── Energy ──────────────────────────────────────────────────────────────────

const ENERGY_CYCLE: EnergyLevel[] = ['low', 'medium', 'high'];
const ENERGY_DISPLAY: Record<EnergyLevel, { label: string; color: string }> = {
    low: { label: 'Low lift', color: '#22C55E' },
    medium: { label: 'Medium', color: '#F59E0B' },
    high: { label: 'Deep focus', color: '#EF4444' },
};

interface EnergyPillProps {
    value: EnergyLevel;
    onChange: (value: EnergyLevel) => void;
}

export const EnergyPill = memo(function EnergyPill({ value, onChange }: EnergyPillProps) {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const handleTap = useCallback(() => {
        haptic('selection');
        scale.value = withSpring(0.9, SPRING_SNAPPY);
        setTimeout(() => { scale.value = withSpring(1, SPRING_SNAPPY); }, 80);
        const idx = ENERGY_CYCLE.indexOf(value);
        onChange(ENERGY_CYCLE[(idx + 1) % ENERGY_CYCLE.length]);
    }, [value, onChange, scale]);

    const d = ENERGY_DISPLAY[value];

    return (
        <Pressable onPress={handleTap}>
            <Animated.View
                style={[styles.pill, { borderColor: d.color, backgroundColor: d.color + '14' }, animStyle]}>
                <Icon name="flash" size={13} color={d.color} />
                <Text style={[styles.pillText, { color: d.color, fontWeight: '600' }]}>
                    {d.label}
                </Text>
            </Animated.View>
        </Pressable>
    );
});

// ── Estimate Pill ───────────────────────────────────────────────────────────

interface EstimatePillProps {
    value: number | null;
    onPress: () => void;
}

export const EstimatePill = memo(function EstimatePill({ value, onPress }: EstimatePillProps) {
    const hasValue = value != null && value > 0;
    return (
        <Pressable
            style={[
                styles.pill,
                hasValue && { borderColor: Colors.gray800, backgroundColor: Colors.gray800 + '0A' },
            ]}
            onPress={() => { haptic('selection'); onPress(); }}>
            <Icon name="time-outline" size={13} color={hasValue ? Colors.gray800 : Colors.gray400} />
            <Text style={[styles.pillText, hasValue && { color: Colors.gray800, fontWeight: '600' }]}>
                {hasValue ? `~${formatMinutes(value!)}` : 'How long?'}
            </Text>
        </Pressable>
    );
});

// ── Deadline Pill ───────────────────────────────────────────────────────────

interface DeadlinePillProps {
    value: number | null;
    onPress: () => void;
}

export const DeadlinePill = memo(function DeadlinePill({ value, onPress }: DeadlinePillProps) {
    const hasValue = value !== null;
    const label = hasValue ? formatDeadlineShort(value!) : 'Deadline';

    return (
        <Pressable
            style={[
                styles.pill,
                hasValue && { borderColor: Colors.gray800, backgroundColor: Colors.gray800 + '0A' },
            ]}
            onPress={() => { haptic('selection'); onPress(); }}>
            <Icon name="calendar-outline" size={13} color={hasValue ? Colors.gray800 : Colors.gray400} />
            <Text style={[styles.pillText, hasValue && { color: Colors.gray800, fontWeight: '600' }]}>
                {label}
            </Text>
        </Pressable>
    );
});

function formatDeadlineShort(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const h = date.getHours() % 12 || 12;
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';

    if (diffDays <= 0) return `Today ${h}${ampm}`;
    if (diffDays === 1) return `Tmrw ${h}${ampm}`;
    if (diffDays <= 7) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

// ── Time Quick Pick ─────────────────────────────────────────────────────────

const TIME_OPTIONS = [5, 15, 30, 60, 120, 240];

interface TimeQuickPickProps {
    value: number | null;
    onChange: (minutes: number | null) => void;
}

/** Smart step size — faster for larger values */
function getStepSize(val: number): number {
    if (val < 30) return 5;
    if (val < 120) return 15;
    return 30;
}

export const TimeQuickPick = memo(function TimeQuickPick({ value, onChange }: TimeQuickPickProps) {
    const [showStepper, setShowStepper] = useState(false);
    const isCustom = value != null && value > 0 && !TIME_OPTIONS.includes(value);
    const currentVal = value ?? 45;

    const handleToggleStepper = useCallback(() => {
        haptic('selection');
        if (showStepper) {
            setShowStepper(false);
        } else {
            setShowStepper(true);
            if (!isCustom && (value == null || TIME_OPTIONS.includes(value))) {
                onChange(45);
            }
        }
    }, [showStepper, isCustom, value, onChange]);

    const handleIncrement = useCallback(() => {
        const step = getStepSize(currentVal);
        onChange(Math.min(currentVal + step, 480));
        haptic('selection');
    }, [currentVal, onChange]);

    const handleDecrement = useCallback(() => {
        const step = getStepSize(currentVal - 1);
        onChange(Math.max(currentVal - step, 5));
        haptic('selection');
    }, [currentVal, onChange]);

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.timeContainer}>
            {/* Preset durations */}
            <View style={styles.timeRow}>
                {TIME_OPTIONS.map((mins) => {
                    const isSelected = value === mins;
                    return (
                        <Pressable
                            key={mins}
                            style={[styles.timePill, isSelected && styles.timePillActive]}
                            onPress={() => {
                                haptic('selection');
                                setShowStepper(false);
                                onChange(isSelected ? null : mins);
                            }}>
                            <Text style={[styles.timePillText, isSelected && styles.timePillTextActive]}>
                                {formatMinutes(mins)}
                            </Text>
                        </Pressable>
                    );
                })}
                <Pressable
                    style={[styles.timePillPlus, (showStepper || isCustom) && styles.timePillActive]}
                    onPress={handleToggleStepper}>
                    <Icon
                        name={showStepper ? 'close' : 'add'}
                        size={18}
                        color={(showStepper || isCustom) ? Colors.white : Colors.gray500}
                    />
                </Pressable>
            </View>

            {/* Custom duration stepper — no typing, just tap */}
            {showStepper && (
                <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={styles.stepperRow}>
                    <Pressable onPress={handleDecrement} hitSlop={8} style={styles.stepperBtn}>
                        <Icon name="remove-circle" size={32} color={Colors.gray400} />
                    </Pressable>
                    <View style={styles.stepperDisplay}>
                        <Text style={styles.stepperValue}>{formatMinutes(currentVal)}</Text>
                    </View>
                    <Pressable onPress={handleIncrement} hitSlop={8} style={styles.stepperBtn}>
                        <Icon name="add-circle" size={32} color={Colors.surfaceDark} />
                    </Pressable>
                </Animated.View>
            )}
        </Animated.View>
    );
});

// ── Property Row (for TaskDetailScreen) ─────────────────────────────────────

interface PropertyRowProps {
    icon: string;
    label: string;
    value: string;
    valueColor?: string;
    onPress: () => void;
    hint?: string;
}

export const PropertyRow = memo(function PropertyRow({
    icon,
    label,
    value,
    valueColor,
    onPress,
    hint,
}: PropertyRowProps) {
    return (
        <Pressable style={styles.propertyRow} onPress={onPress}>
            <Icon name={icon} size={18} color={Colors.gray500} style={styles.propertyIcon} />
            <Text style={styles.propertyLabel}>{label}</Text>
            <Text
                style={[
                    styles.propertyValue,
                    valueColor ? { color: valueColor } : null,
                ]}
                numberOfLines={1}>
                {value}
            </Text>
            <Icon name="chevron-forward" size={14} color={Colors.gray400} />
        </Pressable>
    );
});

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // Pills
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 30,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 15,
        gap: 4,
        backgroundColor: Colors.gray50,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.gray400,
    },

    // Time Quick Pick
    timeContainer: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xs,
    },
    timeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    timePill: {
        flex: 1,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 8,
    },
    timePillActive: {
        backgroundColor: Colors.surfaceDark,
        borderColor: Colors.surfaceDark,
    },
    timePillText: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.gray500,
    },
    timePillTextActive: {
        color: Colors.white,
    },
    timePillPlus: {
        width: 34,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: 8,
        backgroundColor: Colors.gray50,
    },
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xs,
        gap: Spacing.xl,
    },
    stepperBtn: {
        padding: 4,
    },
    stepperDisplay: {
        minWidth: 80,
        alignItems: 'center',
    },
    stepperValue: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.text,
        letterSpacing: -0.3,
    },

    // Property Row (detail screen)
    propertyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    propertyIcon: {
        width: 28,
    },
    propertyLabel: {
        fontSize: 15,
        color: Colors.textSecondary,
        flex: 1,
    },
    propertyValue: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.text,
        marginRight: 6,
    },
});
