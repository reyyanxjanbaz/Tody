/**
 * FocusOrb — Hold-to-activate focus mode, lives in the bottom nav bar.
 *
 * A flame icon with "Focus" label — simple, clean, familiar.
 * The only visual hint that this is "different": a thin ring around
 * the icon that breathes gently (slow opacity pulse).
 *
 * On tap:  icon wiggles, a pill floats up saying "Hold to Focus"
 * On hold: the pill becomes a progress bar — a fill sweeps left-to-right
 *          behind the text. Black fill in light mode, white in dark mode.
 *          Haptics accelerate throughout.
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
import { Spacing, FontFamily, Typography, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY } from '../utils/animations';

const HOLD_DURATION = 1500;
const ICON_SIZE = 24;
const RING_SIZE = 36;
const PILL_HEIGHT = 30;
const PILL_WIDTH = 150;

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
      wiggle.value = withSequence(
        withTiming(14, { duration: 50 }),
        withTiming(-12, { duration: 50 }),
        withTiming(8, { duration: 45 }),
        withTiming(-4, { duration: 40 }),
        withTiming(0, { duration: 35 }),
      );
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

      // Show pill immediately
      hintOpacity.value = withTiming(1, { duration: 100 });

      holdScale.value = withSequence(
        withSpring(0.9, { damping: 15, stiffness: 400 }),
        withTiming(1.15, {
          duration: HOLD_DURATION * 0.9,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
      );

      cancelAnimation(ringBreath);
      ringBreath.value = 1;

      // Fill progress — drives the pill progress bar
      progress.value = withTiming(1, {
        duration: HOLD_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }, (finished) => {
        if (finished && isHolding.value) {
          holdScale.value = withSequence(
            withSpring(1.45, { damping: 8, stiffness: 250, mass: 0.4 }),
            withSpring(1, SPRING_SNAPPY),
          );
          hintOpacity.value = withTiming(0, { duration: 150 });
          runOnJS(triggerActivation)();
        }
      });

      runOnJS(startHapticPulse)();
    })
    .onEnd(() => {
      'worklet';
      isHolding.value = false;
      cancelAnimation(progress);
      progress.value = withSpring(0, SPRING_SNAPPY);
      holdScale.value = withSpring(1, SPRING_SNAPPY);
      hintOpacity.value = withDelay(200, withTiming(0, { duration: 250 }));

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
      hintOpacity.value = withDelay(200, withTiming(0, { duration: 250 }));

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

  const ringStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(ringBreath.value, [0, 1], [0.12, 0.25]);
    const holdOpacity = interpolate(progress.value, [0, 0.1, 1], [0, 0.5, 0.9]);
    const holdWidth = interpolate(
      progress.value, [0, 1], [RING_STROKE_IDLE, RING_STROKE_ACTIVE],
    );
    const opacity = Math.max(baseOpacity, holdOpacity);
    const borderWidth = progress.value > 0.01 ? holdWidth : RING_STROKE_IDLE;
    return { opacity, borderWidth };
  });

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.15, 0.3]),
  }));

  // ── Hint progress pill styles ──────────────────────────────────────────

  const hintPillStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [
      { translateY: interpolate(hintOpacity.value, [0, 1], [6, 0]) },
      { scale: interpolate(hintOpacity.value, [0, 1], [0.92, 1]) },
    ],
  }));

  // Progress fill inside the pill — sweeps left to right
  const pillFillStyle = useAnimatedStyle(() => {
    const widthPercent = interpolate(progress.value, [0, 1], [0, 100]);
    return {
      width: `${widthPercent}%` as any,
      opacity: interpolate(progress.value, [0, 0.02, 1], [0, 0.3, 0.55]),
    };
  });

  // Pill border intensifies during hold
  const pillBorderStyle = useAnimatedStyle(() => {
    const alpha = interpolate(
      progress.value, [0, 0.05, 1], [isDark ? 0.25 : 0.15, isDark ? 0.8 : 0.7, 1],
    );
    return {
      borderColor: isDark
        ? `rgba(255,255,255,${alpha})`
        : `rgba(0,0,0,${alpha})`,
      borderWidth: interpolate(progress.value, [0, 0.05, 1], [1, 2, 2.5]),
    };
  });

  return (
    <View style={styles.wrapper}>
      {/* Floating progress pill */}
      <Animated.View
        style={[styles.hintPillOuter, hintPillStyle]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.hintPill, pillBorderStyle]}>
          <Animated.View style={[styles.pillFill, pillFillStyle]} />
          <Text style={styles.hintText}>Hold to Focus</Text>
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.touchArea, containerStyle]}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.fillDisc, fillStyle]} />
          <Animated.View style={iconStyle}>
            <Icon
              name="flame-outline"
              size={ICON_SIZE}
              color={isDark ? colors.white : colors.text}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

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
    hintPillOuter: {
      position: 'absolute',
      top: -38,
      left: '50%',
      marginLeft: -(PILL_WIDTH / 2),
      width: PILL_WIDTH,
    },
    hintPill: {
      height: PILL_HEIGHT,
      width: PILL_WIDTH,
      borderRadius: PILL_HEIGHT / 2,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
      backgroundColor: isDark ? 'rgba(25,25,25,0.97)' : 'rgba(255,255,255,0.98)',
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
    pillFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: isDark ? '#ffffff' : '#000000',
      borderRadius: PILL_HEIGHT / 2,
    },
    hintText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? c.white : c.text,
      fontFamily: FontFamily,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  });
