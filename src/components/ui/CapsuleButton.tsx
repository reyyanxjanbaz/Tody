import React, { memo, useCallback } from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors, Shadows, BorderRadius } from '../../utils/colors';
import { SPRING_SNAPPY } from '../../utils/animations';
import { haptic } from '../../utils/haptics';

interface CapsuleButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const PRESS_SCALE = 0.95;

export const CapsuleButton = memo(function CapsuleButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'medium',
  disabled = false,
  style,
  textStyle,
}: CapsuleButtonProps) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled) return;
    haptic('heavy');
    onPress();
  }, [onPress, disabled]);

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(PRESS_SCALE, SPRING_SNAPPY);
    })
    .onFinalize((_e, success) => {
      'worklet';
      scale.value = withSpring(1, SPRING_SNAPPY);
      if (success) {
        import('react-native-reanimated').then(({ runOnJS: rjs }) => {});
      }
    });

  // We use a simpler approach: Pressable with animated style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerStyle = [
    styles.base,
    sizeStyles[size],
    variantStyles[variant],
    disabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    sizeLabelStyles[size],
    variantLabelStyles[variant],
    disabled && styles.disabledLabel,
    textStyle,
  ];

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[containerStyle, animatedStyle]}
        onTouchEnd={handlePress}
      >
        {icon && icon}
        <Text style={labelStyle}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: BorderRadius.button,
  },
  label: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  disabled: {
    opacity: 0.4,
  },
  disabledLabel: {
    opacity: 0.6,
  },
});

const sizeStyles = StyleSheet.create({
  small: {
    height: 36,
    paddingHorizontal: 16,
  },
  medium: {
    height: 48,
    paddingHorizontal: 24,
  },
  large: {
    height: 56,
    paddingHorizontal: 32,
  },
});

const sizeLabelStyles = StyleSheet.create({
  small: {
    fontSize: 13,
  },
  medium: {
    fontSize: 15,
  },
  large: {
    fontSize: 17,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.surfaceDark,
  },
  secondary: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.surfaceDark,
  },
  ghost: {
    backgroundColor: Colors.surfaceGlass,
    shadowOpacity: 0,
    elevation: 0,
  },
});

const variantLabelStyles = StyleSheet.create({
  primary: {
    color: Colors.white,
  },
  secondary: {
    color: Colors.surfaceDark,
  },
  ghost: {
    color: Colors.white,
  },
});
