/**
 * AnimatedCheckbox – morphing checkbox with path interpolation.
 *
 * States:
 *   unchecked → checked: box border shrinks, inner checkmark scales in with SPRING_BOUNCY
 *   locked: subtle shake, muted colors
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
    interpolateColor,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SPRING_SNAPPY, TIMING_MICRO } from '../../utils/animations';
import { haptic } from '../../utils/haptics';
import { Colors } from '../../utils/colors';

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
    const progress = useSharedValue(checked ? 1 : 0);
    const shakeX = useSharedValue(0);
    const pressScale = useSharedValue(1);

    useEffect(() => {
        progress.value = withSpring(checked ? 1 : 0, SPRING_SNAPPY);
    }, [checked, progress]);

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
            pressScale.value = withSpring(0.85, SPRING_SNAPPY);
        })
        .onFinalize((_e, success) => {
            'worklet';
            pressScale.value = withSpring(1, SPRING_SNAPPY);
            if (!success) return;

            if (locked) {
                // Shake animation
                shakeX.value = withSequence(
                    withTiming(4, { duration: 40 }),
                    withTiming(-4, { duration: 40 }),
                    withTiming(4, { duration: 40 }),
                    withTiming(-4, { duration: 40 }),
                    withTiming(0, { duration: 40 }),
                );
                runOnJS(fireLockedHaptic)();
                return;
            }

            runOnJS(fireCheckHaptic)();
            runOnJS(fireToggle)();
        });

    const boxStyle = useAnimatedStyle(() => {
        const bgColor = interpolateColor(
            progress.value,
            [0, 1],
            [Colors.white, Colors.black],
        );
        const borderColor = interpolateColor(
            progress.value,
            [0, 1],
            [locked ? Colors.gray200 : Colors.gray400, Colors.black],
        );

        return {
            width: size,
            height: size,
            borderWidth: 1.5,
            borderRadius: 2,
            backgroundColor: bgColor,
            borderColor: borderColor,
            justifyContent: 'center',
            alignItems: 'center',
            transform: [
                { scale: pressScale.value },
                { translateX: shakeX.value },
            ],
        };
    });

    const innerStyle = useAnimatedStyle(() => ({
        width: size * 0.4,
        height: size * 0.4,
        borderRadius: 1,
        backgroundColor: Colors.white,
        opacity: progress.value,
        transform: [{ scale: progress.value }],
    }));

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={boxStyle} hitSlop={12}>
                <Animated.View style={innerStyle} />
            </Animated.View>
        </GestureDetector>
    );
}
