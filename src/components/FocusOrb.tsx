/**
 * FocusOrb — Hold-to-activate focus mode, lives in the bottom nav bar.
 *
 * Looks like a sibling of the Inbox and Profile nav items.
 * A flame icon with "Focus" label — simple, clean, familiar.
 *
 * The only visual hint that this is "different": a thin ring around
 * the icon that breathes gently (slow opacity pulse). Enough to
 * intrigue without confusing.
 *
 * On tap:  icon wiggles, a tooltip floats up saying "hold to focus"
 * On hold: ring thickens and fills as a progress indicator,
 *          a disc grows behind the icon, haptics accelerate
 * Complete: bloom scale + success haptic → focus mode
 * Cancel:  everything springs back gracefully
 */

import React, { memo, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, FontFamily, Typography, Shadows, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY } from '../utils/animations';

const HOLD_DURATION = 2000;
const ICON_SIZE = 24;
const RING_SIZE = 36;

interface FocusOrbProps {
  onActivate: () => void;
  taskCount?: number;
}

export const FocusOrb = memo(function FocusOrb({
  onActivate,
  taskCount = 0,
}: FocusOrbProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const progress = useSharedValue(0);
  const holdScale = useSharedValue(1);
  const ringBreath = useSharedValue(0);
  const hintOpacity = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const isHolding = useSharedValue(false);
  const hasActivated = useRef(false);

  // ── Haptic heartbeat ──────────────────────────────────────────────────
  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticDelay = useRef(500);

  const startHapticPulse = useCallback(() => {
    haptic('light');
    hapticDelay.current = 500;
    const tick = () => {
      haptic('selection');
      hapticDelay.current = Math.max(150, hapticDelay.current - 40);
      hapticTimer.current = setTimeout(tick, hapticDelay.current);
    };
    hapticTimer.current = setTimeout(tick, hapticDelay.current);
  }, []);

  const stopHapticPulse = useCallback(() => {
    if (hapticTimer.current) {
      clearTimeout(hapticTimer.current);
      hapticTimer.current = null;
    }
  }, []);

  const triggerActivation = useCallback(() => {
    if (hasActivated.current) return;
    hasActivated.current = true;
    stopHapticPulse();
    haptic('success');
    setTimeout(() => {
      onActivate();
      hasActivated.current = false;
    }, 150);
  }, [onActivate, stopHapticPulse]);

  const showTapHint = useCallback(() => {
    haptic('light');
  }, []);

  // ── Idle ring breathing ────────────────────────────────────────────────
  useEffect(() => {
    if (taskCount > 0) {
      ringBreath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }
    return () => {
      cancelAnimation(ringBreath);
      stopHapticPulse();
    };
  }, [taskCount, ringBreath, stopHapticPulse]);

  // ── Gestures ───────────────────────────────────────────────────────────

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      // Wiggle the icon
      wiggle.value = withSequence(
        withTiming(14, { duration: 50 }),
        withTiming(-12, { duration: 50 }),
        withTiming(8, { duration: 45 }),
        withTiming(-4, { duration: 40 }),
        withTiming(0, { duration: 35 }),
      );
      // Show "HOLD TO FOCUS" hint
      hintOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(1800, withTiming(0, { duration: 350 })),
      );
      runOnJS(showTapHint)();
    });

  const holdGesture = Gesture.LongPress()
    .minDuration(120)
    .maxDistance(50)
    .onStart(() => {
      'worklet';
      isHolding.value = true;

      holdScale.value = withSpring(0.92, SPRING_SNAPPY);

      cancelAnimation(ringBreath);
      ringBreath.value = 1;

      // Fill progress
      progress.value = withTiming(1, {
        duration: HOLD_DURATION,
        easing: Easing.bezier(0.35, 0.05, 0.25, 1),
      }, (finished) => {
        if (finished && isHolding.value) {
          holdScale.value = withSequence(
            withSpring(1.3, { damping: 10, stiffness: 200, mass: 0.5 }),
            withSpring(1, SPRING_SNAPPY),
          );
          runOnJS(triggerActivation)();
        }
      });

      // Hide hint if showing
      hintOpacity.value = withTiming(0, { duration: 80 });

      runOnJS(startHapticPulse)();
    })
    .onEnd(() => {
      'worklet';
      isHolding.value = false;
      cancelAnimation(progress);
      progress.value = withSpring(0, SPRING_SNAPPY);
      holdScale.value = withSpring(1, SPRING_SNAPPY);

      ringBreath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );

      runOnJS(stopHapticPulse)();
    })
    .onFinalize(() => {
      'worklet';
      if (!isHolding.value) return;
      isHolding.value = false;
      cancelAnimation(progress);
      progress.value = withSpring(0, SPRING_SNAPPY);
      holdScale.value = withSpring(1, SPRING_SNAPPY);

      ringBreath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );

      runOnJS(stopHapticPulse)();
    });

  const gesture = Gesture.Exclusive(holdGesture, tapGesture);

  // ── Animated styles ────────────────────────────────────────────────────

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: holdScale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wiggle.value}deg` }],
    opacity: interpolate(progress.value, [0, 0.3], [0.6, 1], 'clamp'),
  }));

  // Ring: breathes at idle, fills during hold
  const ringStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(ringBreath.value, [0, 1], [0.12, 0.25]);
    const holdOpacity = interpolate(progress.value, [0, 0.1, 1], [0, 0.5, 0.9]);
    const holdWidth = interpolate(progress.value, [0, 1], [RING_STROKE_IDLE, RING_STROKE_ACTIVE]);

    const opacity = Math.max(baseOpacity, holdOpacity);
    const borderWidth = progress.value > 0.01 ? holdWidth : RING_STROKE_IDLE;

    return {
      opacity,
      borderWidth,
    };
  });

  // Fill disc behind icon during hold
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.15, 0.3]),
  }));

  // Hint tooltip
  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [
      { translateY: interpolate(hintOpacity.value, [0, 1], [5, 0]) },
    ],
  }));

  if (taskCount === 0) return null;

  return (
    <View style={styles.wrapper}>
      {/* Floating hint — appears on tap */}
      <Animated.View style={[styles.hintBubble, hintStyle]} pointerEvents="none">
        <Text style={styles.hintText}>Hold to Focus</Text>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.touchArea, containerStyle]}>
          {/* Ring around icon */}
          <Animated.View style={[styles.ring, ringStyle]} />

          {/* Fill disc */}
          <Animated.View style={[styles.fillDisc, fillStyle]} />

          {/* Icon */}
          <Animated.View style={iconStyle}>
            <Icon
              name="flame-outline"
              size={ICON_SIZE}
              color={isDark ? colors.white : colors.text}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Label */}
      <Text style={styles.label}>Focus</Text>
    </View>
  );
});

// ── Constants ────────────────────────────────────────────────────────────────

const RING_STROKE_IDLE = 1.5;
const RING_STROKE_ACTIVE = 3.5;

// ── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      gap: 2,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    touchArea: {
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_SIZE / 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ring: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: RING_SIZE / 2,
      borderWidth: RING_STROKE_IDLE,
      borderColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
    },
    fillDisc: {
      position: 'absolute',
      width: RING_SIZE - 4,
      height: RING_SIZE - 4,
      borderRadius: (RING_SIZE - 4) / 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
    },
    label: {
      ...Typography.caption,
      fontWeight: '600',
      color: c.textSecondary,
    },
    hintBubble: {
      position: 'absolute',
      top: -32,
      alignSelf: 'center',
      backgroundColor: isDark ? c.surface : c.gray800,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 6,
      minWidth: 110,
      alignItems: 'center',
      ...Shadows.subtle,
    },
    hintText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? c.text : c.white,
      fontFamily: FontFamily,
      letterSpacing: 0.2,
    },
  });
