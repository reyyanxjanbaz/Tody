import React, { memo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Spacing } from '../utils/colors';

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

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}>
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
    </Pressable>
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
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.4,
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
