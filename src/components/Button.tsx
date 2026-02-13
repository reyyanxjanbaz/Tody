/**
 * Button – spring-animated pressable with haptic feedback.
 *
 * Press: scale 1 → 0.96 with SPRING_SNAPPY, light haptic
 * Loading: ActivityIndicator with crossfade
 * Variants: primary (black fill), secondary (outlined), ghost (transparent)
 */

import React, { memo, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors, Spacing } from '../utils/colors';
import { SPRING_SNAPPY, PRESS_SCALE, TIMING_FADE } from '../utils/animations';
import { haptic } from '../utils/haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button = memo(function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const firePress = useCallback(() => {
    haptic('light');
    onPress();
  }, [onPress]);

  const gesture = Gesture.Tap()
    .enabled(!isDisabled)
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(PRESS_SCALE, SPRING_SNAPPY);
      opacity.value = withTiming(0.85, TIMING_FADE);
    })
    .onFinalize((_e, success) => {
      'worklet';
      scale.value = withSpring(1, SPRING_SNAPPY);
      opacity.value = withTiming(1, TIMING_FADE);
      if (success) {
        runOnJS(firePress)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isDisabled ? 0.4 : opacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.base,
          styles[variant],
          animatedStyle,
          style,
        ]}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? Colors.white : Colors.black}
            size="small"
          />
        ) : (
          <Text
            style={[
              styles.text,
              variant === 'primary' && styles.textPrimary,
              variant === 'secondary' && styles.textSecondary,
              variant === 'ghost' && styles.textGhost,
              textStyle,
            ]}>
            {title}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  base: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    paddingHorizontal: Spacing.xl,
  },
  primary: {
    backgroundColor: Colors.black,
  },
  secondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.black,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  textPrimary: {
    color: Colors.white,
  },
  textSecondary: {
    color: Colors.black,
  },
  textGhost: {
    color: Colors.textSecondary,
  },
});
