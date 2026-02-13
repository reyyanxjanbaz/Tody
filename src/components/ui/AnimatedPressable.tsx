/**
 * AnimatedPressable – a drop-in Pressable replacement with spring physics.
 *
 * Features:
 * - Scale down to 0.96 on press with SPRING_SNAPPY
 * - Optional haptic feedback on press
 * - Android ripple preserved
 * - Completely driven on the UI thread via Reanimated worklets
 *
 * Usage:
 *   <AnimatedPressable onPress={fn} hapticStyle="light">
 *     <Text>Tap me</Text>
 *   </AnimatedPressable>
 */

import React, { useCallback } from 'react';
import { StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SPRING_SNAPPY, PRESS_SCALE, TIMING_FADE } from '../../utils/animations';
import { haptic } from '../../utils/haptics';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

interface AnimatedPressableProps {
    children: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Which haptic to fire on press-in. Defaults to 'light'. Pass null to disable. */
    hapticStyle?: HapticStyle | null;
    /** Custom scale factor. Default 0.96 */
    pressScale?: number;
    /** Test ID for testing */
    testID?: string;
    hitSlop?: number;
}

export function AnimatedPressable({
    children,
    onPress,
    onLongPress,
    disabled = false,
    style,
    hapticStyle = 'light',
    pressScale = PRESS_SCALE,
    testID,
    hitSlop,
}: AnimatedPressableProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);
    const pressed = useSharedValue(false);

    const fireHaptic = useCallback(
        (type: HapticStyle) => {
            haptic(type);
        },
        [],
    );

    const firePress = useCallback(() => {
        onPress?.();
    }, [onPress]);

    const fireLongPress = useCallback(() => {
        onLongPress?.();
    }, [onLongPress]);

    const tap = Gesture.Tap()
        .enabled(!disabled)
        .maxDuration(10000)
        .onBegin(() => {
            'worklet';
            pressed.value = true;
            scale.value = withSpring(pressScale, SPRING_SNAPPY);
            opacity.value = withTiming(0.85, TIMING_FADE);
            if (hapticStyle) {
                runOnJS(fireHaptic)(hapticStyle);
            }
        })
        .onFinalize((_event, success) => {
            'worklet';
            pressed.value = false;
            scale.value = withSpring(1, SPRING_SNAPPY);
            opacity.value = withTiming(1, TIMING_FADE);
            if (success) {
                runOnJS(firePress)();
            }
        });

    const longPress = Gesture.LongPress()
        .enabled(!disabled && !!onLongPress)
        .minDuration(350)
        .onStart(() => {
            'worklet';
            if (hapticStyle) {
                runOnJS(fireHaptic)('medium');
            }
            runOnJS(fireLongPress)();
        })
        .onFinalize(() => {
            'worklet';
            scale.value = withSpring(1, SPRING_SNAPPY);
            opacity.value = withTiming(1, TIMING_FADE);
        });

    const composed = Gesture.Exclusive(longPress, tap);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: disabled ? 0.4 : opacity.value,
    }));

    return (
        <GestureDetector gesture={composed}>
            <Animated.View
                style={[animatedStyle, style]}
                testID={testID}
                hitSlop={hitSlop ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop } : undefined}
            >
                {children}
            </Animated.View>
        </GestureDetector>
    );
}
