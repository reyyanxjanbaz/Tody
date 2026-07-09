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
import { Spacing, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
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
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

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
            color={variant === 'primary' ? colors.white : colors.black}
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  base: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.xxl,
  },
  primary: {
    backgroundColor: c.surfaceDark,
  },
  secondary: {
    backgroundColor: c.white,
    borderWidth: 1.5,
    borderColor: c.surfaceDark,
  },
  ghost: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontFamily: FontFamily,
  },
  textPrimary: {
    color: c.white,
  },
  textSecondary: {
    color: c.black,
  },
  textGhost: {
    color: c.textSecondary,
  },
});
