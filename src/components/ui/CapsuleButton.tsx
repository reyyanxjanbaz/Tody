import React, { memo, useCallback } from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BorderRadius, FontFamily, type ThemeColors } from '../../utils/colors';
import { useTheme } from '../../context/ThemeContext';
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
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);


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
                import('react-native-reanimated').then(({ runOnJS: rjs }) => { });
            }
        });

    // We use a simpler approach: Pressable with animated style
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const variantStyleMap = {
        primary: styles.variantPrimary,
        secondary: styles.variantSecondary,
        ghost: styles.variantGhost,
    };

    const variantLabelMap = {
        primary: styles.variantLabelPrimary,
        secondary: styles.variantLabelSecondary,
        ghost: styles.variantLabelGhost,
    };

    const containerStyle = [
        styles.base,
        sizeStyles[size],
        variantStyleMap[variant],
        disabled && styles.disabled,
        style,
    ];

    const labelStyle = [
        styles.label,
        sizeLabelStyles[size],
        variantLabelMap[variant],
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
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
    // variant styles (need theme colors)
    variantPrimary: {
        backgroundColor: c.surfaceDark,
    },
    variantSecondary: {
        backgroundColor: c.white,
        borderWidth: 1.5,
        borderColor: c.surfaceDark,
    },
    variantGhost: {
        backgroundColor: c.surfaceGlass,
        shadowOpacity: 0,
        elevation: 0,
    },
    // variant label styles (need theme colors)
    variantLabelPrimary: {
        color: c.white,
    },
    variantLabelSecondary: {
        color: c.surfaceDark,
    },
    variantLabelGhost: {
        color: c.white,
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
    fontFamily: FontFamily,
    },
    medium: {
        fontSize: 15,
    fontFamily: FontFamily,
    },
    large: {
        fontSize: 17,
    fontFamily: FontFamily,
    },
});
