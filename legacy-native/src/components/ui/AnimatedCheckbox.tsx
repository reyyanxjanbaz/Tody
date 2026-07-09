/**
 * AnimatedCheckbox – polished checkbox with checkmark stroke animation.
 *
 * States:
 *   unchecked → checked: border morphs to filled circle, checkmark draws in with
 *                        bouncy spring + slight overshoot + scale pop
 *   locked: subtle shake, muted colors, haptic warning
 *
 * Entirely Reanimated worklet-driven for 60fps.
 */

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    interpolate,
    interpolateColor,
    Extrapolation,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SPRING_SNAPPY, SPRING_BOUNCY } from '../../utils/animations';
import { haptic } from '../../utils/haptics';
import { type ThemeColors } from '../../utils/colors';
import { useTheme } from '../../context/ThemeContext';

interface AnimatedCheckboxProps {
    checked: boolean;
    locked?: boolean;
    onToggle: () => void;
    size?: number;
}

export function AnimatedCheckbox({
    checked,
    locked = false,
    onToggle,
    size = 20,
}: AnimatedCheckboxProps) {
    const { colors, isDark } = useTheme();
    const progress = useSharedValue(checked ? 1 : 0);
    const shakeX = useSharedValue(0);
    const pressScale = useSharedValue(1);
    const celebrateScale = useSharedValue(1);

    useEffect(() => {
        if (checked) {
            // Bouncy spring for check-in with celebration pop
            progress.value = withSpring(1, {
                damping: 12,
                stiffness: 200,
                mass: 0.7,
                overshootClamping: false,
            });
            celebrateScale.value = withSequence(
                withTiming(1.25, { duration: 120 }),
                withSpring(1, {
                    damping: 6,
                    stiffness: 300,
                    mass: 0.5,
                }),
            );
        } else {
            progress.value = withTiming(0, { duration: 200 });
            celebrateScale.value = withTiming(1, { duration: 150 });
        }
    }, [checked, progress, celebrateScale]);

    const fireToggle = useCallback(() => {
        onToggle();
    }, [onToggle]);

    const fireLockedHaptic = useCallback(() => {
        haptic('warning');
    }, []);

    const fireCheckHaptic = useCallback(() => {
        haptic('success');
    }, []);

    const gesture = Gesture.Tap()
        .onBegin(() => {
            'worklet';
            pressScale.value = withSpring(0.8, SPRING_SNAPPY);
        })
        .onFinalize((_e, success) => {
            'worklet';
            pressScale.value = withSpring(1, {
                damping: 8,
                stiffness: 250,
                mass: 0.6,
            });
            if (!success) return;

            if (locked) {
                shakeX.value = withSequence(
                    withTiming(5, { duration: 35 }),
                    withTiming(-5, { duration: 35 }),
                    withTiming(4, { duration: 35 }),
                    withTiming(-4, { duration: 35 }),
                    withTiming(2, { duration: 35 }),
                    withTiming(0, { duration: 35 }),
                );
                runOnJS(fireLockedHaptic)();
                return;
            }

            runOnJS(fireCheckHaptic)();
            runOnJS(fireToggle)();
        });

    const fillColor = isDark ? '#FFFFFF' : '#000000';
    const emptyBorderColor = isDark
        ? (locked ? colors.gray200 : 'rgba(255,255,255,0.5)')
        : (locked ? colors.gray200 : colors.gray400);

    const boxStyle = useAnimatedStyle(() => {
        const bgColor = interpolateColor(
            progress.value,
            [0, 0.5, 1],
            [isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', fillColor, fillColor],
        );
        const borderColor = interpolateColor(
            progress.value,
            [0, 0.5, 1],
            [emptyBorderColor, fillColor, fillColor],
        );
        const borderWidth = interpolate(
            progress.value,
            [0, 0.5, 1],
            [1.5, 1.5, 0],
            Extrapolation.CLAMP,
        );
        const borderRadius = interpolate(
            progress.value,
            [0, 1],
            [size * 0.15, size * 0.5],
            Extrapolation.CLAMP,
        );

        return {
            width: size,
            height: size,
            borderWidth: borderWidth,
            borderRadius: borderRadius,
            backgroundColor: bgColor,
            borderColor: borderColor,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            transform: [
                { scale: pressScale.value * celebrateScale.value },
                { translateX: shakeX.value },
            ],
        };
    });

    // Short arm of checkmark (bottom-left to center-bottom)
    const shortArmStyle = useAnimatedStyle(() => {
        const armProgress = interpolate(
            progress.value,
            [0.3, 0.6],
            [0, 1],
            Extrapolation.CLAMP,
        );
        const armWidth = size * 0.25;

        return {
            position: 'absolute' as const,
            width: armWidth * armProgress,
            height: size * 0.12,
            backgroundColor: isDark ? '#000000' : '#FFFFFF',
            borderRadius: size * 0.06,
            bottom: size * 0.28,
            left: size * 0.15,
            transform: [{ rotate: '45deg' }],
            opacity: interpolate(progress.value, [0.25, 0.4], [0, 1], Extrapolation.CLAMP),
        };
    });

    // Long arm of checkmark (center-bottom to top-right)
    const longArmStyle = useAnimatedStyle(() => {
        const armProgress = interpolate(
            progress.value,
            [0.5, 1],
            [0, 1],
            Extrapolation.CLAMP,
        );
        const armWidth = size * 0.5;

        return {
            position: 'absolute' as const,
            width: armWidth * armProgress,
            height: size * 0.12,
            backgroundColor: isDark ? '#000000' : '#FFFFFF',
            borderRadius: size * 0.06,
            bottom: size * 0.35,
            left: size * 0.25,
            transform: [{ rotate: '-45deg' }],
            opacity: interpolate(progress.value, [0.45, 0.55], [0, 1], Extrapolation.CLAMP),
        };
    });

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={boxStyle} hitSlop={12}>
                <Animated.View style={shortArmStyle} />
                <Animated.View style={longArmStyle} />
            </Animated.View>
        </GestureDetector>
    );
}
