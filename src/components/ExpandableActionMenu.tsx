/**
 * ExpandableActionMenu — Pokémon Go–style arc-expanding action hub.
 *
 * Replaces the bottom navigation bar. Centered at the bottom of the screen.
 * A single trigger button fans out contextual actions in a symmetrical arc.
 *
 * Fixed issues:
 *   ✓ pointerEvents driven by React state (not shared value read at render)
 *   ✓ Solid white/dark borders for visibility on dark backdrop
 *   ✓ Labels with background pills, larger text, high contrast
 *   ✓ Heavier backdrop tint (0.55)
 *   ✓ All buttons functional (gesture handlers always active when expanded)
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  AccessibilityRole,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  runOnJS,
  cancelAnimation,
  Extrapolation,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  Spacing,
  BorderRadius,
  FontFamily,
  Typography,
  type ThemeColors,
} from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { SPRING_SNAPPY, PRESS_SCALE } from '../utils/animations';
import { haptic } from '../utils/haptics';

// ── Types ──────────────────────────────────────────────────────────────────

type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
  color?: string;
  hapticStyle?: HapticStyle;
  badge?: number;
  holdToActivate?: boolean;
}

export interface ExpandableActionMenuProps {
  actions: ActionMenuItem[];
  triggerIcon?: string;
  triggerSize?: number;
  itemSize?: number;
  arcRadius?: number;
  arcSpan?: number;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  taskCount?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_ACTIONS = 5;
const BACKDROP_OPACITY = 0.55;
const HOLD_DURATION = 1200;

// ── Helpers ────────────────────────────────────────────────────────────────

const toRad = (deg: number) => (deg * Math.PI) / 180;

function getArcPositions(count: number, radius: number, arcSpan: number) {
  const positions: { x: number; y: number; angle: number }[] = [];
  if (count === 1) {
    positions.push({ x: 0, y: -radius, angle: 90 });
    return positions;
  }
  const startAngle = 90 + arcSpan / 2;
  const step = arcSpan / (count - 1);
  for (let i = 0; i < count; i++) {
    const angleDeg = startAngle - i * step;
    const angleRad = toRad(angleDeg);
    positions.push({
      x: radius * Math.cos(angleRad),
      y: -radius * Math.sin(angleRad),
      angle: angleDeg,
    });
  }
  return positions;
}

// ── Focus Action Item (hold-to-activate) ───────────────────────────────────

interface FocusActionProps {
  item: ActionMenuItem;
  x: number;
  y: number;
  expansion: SharedValue<number>;
  itemSize: number;
  onActivate: () => void;
  colors: ThemeColors;
  isDark: boolean;
  taskCount: number;
  index: number;
  total: number;
  isOpen: boolean;
}

const FocusActionItem = memo(function FocusActionItem({
  item,
  x,
  y,
  expansion,
  itemSize,
  onActivate,
  colors,
  isDark,
  taskCount,
  index,
  total,
  isOpen,
}: FocusActionProps) {
  const styles = React.useMemo(
    () => createActionStyles(colors, isDark, itemSize),
    [colors, isDark, itemSize],
  );

  const holdProgress = useSharedValue(0);
  const holdScale = useSharedValue(1);
  const ringBreath = useSharedValue(0);
  const isHolding = useSharedValue(false);
  const hasActivated = useRef(false);

  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticDelay = useRef(400);

  const startHapticPulse = useCallback(() => {
    haptic('light');
    hapticDelay.current = 400;
    const tick = () => {
      haptic('selection');
      hapticDelay.current = Math.max(120, hapticDelay.current - 35);
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
    }, 100);
  }, [onActivate, stopHapticPulse]);

  const showTapHint = useCallback(() => {
    haptic('light');
  }, []);

  useEffect(() => {
    if (taskCount > 0 && isOpen) {
      ringBreath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(ringBreath);
      ringBreath.value = 0;
    }
    return () => {
      cancelAnimation(ringBreath);
      stopHapticPulse();
    };
  }, [taskCount, isOpen, ringBreath, stopHapticPulse]);

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      holdScale.value = withSequence(
        withSpring(0.9, SPRING_SNAPPY),
        withSpring(1, SPRING_SNAPPY),
      );
      runOnJS(showTapHint)();
    });

  const holdGesture = Gesture.LongPress()
    .minDuration(100)
    .maxDistance(50)
    .onStart(() => {
      'worklet';
      isHolding.value = true;
      holdScale.value = withSequence(
        withSpring(0.88, { damping: 15, stiffness: 400 }),
        withTiming(1.1, {
          duration: HOLD_DURATION * 0.9,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
      );
      cancelAnimation(ringBreath);
      ringBreath.value = 1;

      holdProgress.value = withTiming(1, {
        duration: HOLD_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }, (finished) => {
        if (finished && isHolding.value) {
          holdScale.value = withSequence(
            withSpring(1.35, { damping: 8, stiffness: 250, mass: 0.4 }),
            withSpring(1, SPRING_SNAPPY),
          );
          runOnJS(triggerActivation)();
        }
      });

      runOnJS(startHapticPulse)();
    })
    .onEnd(() => {
      'worklet';
      isHolding.value = false;
      cancelAnimation(holdProgress);
      holdProgress.value = withSpring(0, SPRING_SNAPPY);
      holdScale.value = withSpring(1, SPRING_SNAPPY);
      runOnJS(stopHapticPulse)();
    })
    .onFinalize(() => {
      'worklet';
      if (!isHolding.value) return;
      isHolding.value = false;
      cancelAnimation(holdProgress);
      holdProgress.value = withSpring(0, SPRING_SNAPPY);
      holdScale.value = withSpring(1, SPRING_SNAPPY);
      runOnJS(stopHapticPulse)();
    });

  const gesture = Gesture.Exclusive(holdGesture, tapGesture);

  const containerStyle = useAnimatedStyle(() => {
    const progress = expansion.value;
    const itemProgress = interpolate(
      progress,
      [0, 0.15 + (index / total) * 0.25, 0.75],
      [0, 0, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(itemProgress, [0, 1], [0.2, 1], Extrapolation.CLAMP);
    const opacity = interpolate(itemProgress, [0, 0.2, 1], [0, 0.4, 1], Extrapolation.CLAMP);
    const tx = interpolate(progress, [0, 1], [0, x], Extrapolation.CLAMP);
    const ty = interpolate(progress, [0, 1], [0, y], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: scale * holdScale.value },
      ],
      opacity,
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(ringBreath.value, [0, 1], [0.2, 0.5]);
    const holdOpacity = interpolate(holdProgress.value, [0, 0.1, 1], [0, 0.5, 0.9]);
    const holdWidth = interpolate(holdProgress.value, [0, 1], [2, 4]);
    return {
      opacity: Math.max(baseOpacity, holdOpacity),
      borderWidth: holdProgress.value > 0.01 ? holdWidth : 2,
    };
  });

  const progressRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: holdProgress.value }],
    opacity: interpolate(holdProgress.value, [0, 0.1, 1], [0, 0.15, 0.35]),
  }));

  const labelStyle = useAnimatedStyle(() => {
    const progress = expansion.value;
    const itemProgress = interpolate(
      progress,
      [0, 0.4 + (index / total) * 0.2, 0.85],
      [0, 0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: itemProgress,
      transform: [
        { translateY: interpolate(itemProgress, [0, 1], [6, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.arcItemContainer, containerStyle]}
      pointerEvents={isOpen ? 'auto' : 'none'}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={`${item.label} — hold to activate`}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.actionCircle}>
          <Animated.View style={[styles.focusRing, ringStyle]} />
          <Animated.View style={[styles.progressDisc, progressRingStyle]} />
          <Icon
            name={item.icon}
            size={itemSize * 0.46}
            color={item.color ?? (isDark ? colors.white : colors.text)}
          />
        </Animated.View>
      </GestureDetector>
      <Animated.View style={[styles.labelPill, labelStyle]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {item.label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

// ── Standard Action Item (tap) ─────────────────────────────────────────────

interface ArcActionItemProps {
  item: ActionMenuItem;
  x: number;
  y: number;
  expansion: SharedValue<number>;
  itemSize: number;
  onActionPress: (item: ActionMenuItem) => void;
  colors: ThemeColors;
  isDark: boolean;
  index: number;
  total: number;
  isOpen: boolean;
}

const ArcActionItem = memo(function ArcActionItem({
  item,
  x,
  y,
  expansion,
  itemSize,
  onActionPress,
  colors,
  isDark,
  index,
  total,
  isOpen,
}: ArcActionItemProps) {
  const styles = React.useMemo(
    () => createActionStyles(colors, isDark, itemSize),
    [colors, isDark, itemSize],
  );

  const pressScale = useSharedValue(1);

  const firePress = useCallback(() => {
    haptic(item.hapticStyle ?? 'medium');
    onActionPress(item);
  }, [item, onActionPress]);

  const containerStyle = useAnimatedStyle(() => {
    const progress = expansion.value;
    const itemProgress = interpolate(
      progress,
      [0, 0.15 + (index / total) * 0.25, 0.75],
      [0, 0, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(itemProgress, [0, 1], [0.2, 1], Extrapolation.CLAMP)
      * pressScale.value;
    const opacity = interpolate(itemProgress, [0, 0.2, 1], [0, 0.4, 1], Extrapolation.CLAMP);
    const tx = interpolate(progress, [0, 1], [0, x], Extrapolation.CLAMP);
    const ty = interpolate(progress, [0, 1], [0, y], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale },
      ],
      opacity,
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const progress = expansion.value;
    const itemProgress = interpolate(
      progress,
      [0, 0.4 + (index / total) * 0.2, 0.85],
      [0, 0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: itemProgress,
      transform: [
        { translateY: interpolate(itemProgress, [0, 1], [6, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  const gesture = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      pressScale.value = withSpring(0.85, SPRING_SNAPPY);
    })
    .onFinalize((_e, success) => {
      'worklet';
      pressScale.value = withSpring(1, SPRING_SNAPPY);
      if (success) {
        runOnJS(firePress)();
      }
    });

  return (
    <Animated.View
      style={[styles.arcItemContainer, containerStyle]}
      pointerEvents={isOpen ? 'auto' : 'none'}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={item.label}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.actionCircle}>
          <Icon
            name={item.icon}
            size={itemSize * 0.46}
            color={item.color ?? (isDark ? colors.white : colors.text)}
          />
          {item.badge != null && item.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.badge > 99 ? '99+' : item.badge}
              </Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
      <Animated.View style={[styles.labelPill, labelStyle]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {item.label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

// ── Main Component ─────────────────────────────────────────────────────────

export const ExpandableActionMenu = memo(function ExpandableActionMenu({
  actions: rawActions,
  triggerIcon = 'apps',
  triggerSize = 56,
  itemSize = 50,
  arcRadius = 135,
  arcSpan = 160,
  bottomInset = 0,
  style,
  testID,
  taskCount = 0,
}: ExpandableActionMenuProps) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(
    () => createStyles(colors, isDark, triggerSize, bottomInset),
    [colors, isDark, triggerSize, bottomInset],
  );

  const actions = rawActions.slice(0, MAX_ACTIONS);
  const arcPositions = React.useMemo(
    () => getArcPositions(actions.length, arcRadius, arcSpan),
    [actions.length, arcRadius, arcSpan],
  );

  // ── State ────────────────────────────────────────────────────────────
  const expansion = useSharedValue(0);
  const triggerScale = useSharedValue(1);
  const isExpanded = useSharedValue(false);
  // React state for pointerEvents — updated via runOnJS
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    return () => {
      cancelAnimation(expansion);
      cancelAnimation(triggerScale);
    };
  }, [expansion, triggerScale]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const setOpen = useCallback(() => { setIsOpen(true); }, []);
  const setClosed = useCallback(() => { setIsOpen(false); }, []);

  const collapse = useCallback(() => {
    'worklet';
    isExpanded.value = false;
    expansion.value = withSpring(0, SPRING_SNAPPY);
    runOnJS(setClosed)();
  }, [expansion, isExpanded, setClosed]);

  const expand = useCallback(() => {
    'worklet';
    isExpanded.value = true;
    expansion.value = withSpring(1, SPRING_SNAPPY);
    runOnJS(setOpen)();
  }, [expansion, isExpanded, setOpen]);

  const fireToggleHaptic = useCallback(() => {
    haptic('light');
  }, []);

  const handleActionPress = useCallback(
    (item: ActionMenuItem) => {
      setIsOpen(false);
      expansion.value = withSpring(0, SPRING_SNAPPY);
      isExpanded.value = false;
      setTimeout(() => {
        item.onPress();
      }, 100);
    },
    [expansion, isExpanded],
  );

  const handleBackdropPress = useCallback(() => {
    haptic('light');
    setIsOpen(false);
    expansion.value = withSpring(0, SPRING_SNAPPY);
    isExpanded.value = false;
  }, [expansion, isExpanded]);

  const handleFocusActivate = useCallback(
    (item: ActionMenuItem) => {
      setIsOpen(false);
      expansion.value = withSpring(0, SPRING_SNAPPY);
      isExpanded.value = false;
      setTimeout(() => {
        item.onPress();
      }, 100);
    },
    [expansion, isExpanded],
  );

  // ── Trigger gesture ──────────────────────────────────────────────────

  const triggerGesture = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      triggerScale.value = withSpring(PRESS_SCALE, SPRING_SNAPPY);
    })
    .onFinalize((_e, success) => {
      'worklet';
      triggerScale.value = withSpring(1, SPRING_SNAPPY);
      if (success) {
        runOnJS(fireToggleHaptic)();
        if (isExpanded.value) {
          collapse();
        } else {
          expand();
        }
      }
    });

  const backdropGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet';
      runOnJS(handleBackdropPress)();
    });

  // ── Animated styles ──────────────────────────────────────────────────

  const triggerAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: triggerScale.value },
      { rotate: `${interpolate(expansion.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 1], [0, BACKDROP_OPACITY]),
    pointerEvents: expansion.value > 0.05 ? 'auto' : 'none',
  }));

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <GestureDetector gesture={backdropGesture}>
        <Animated.View
          style={[styles.backdrop, backdropAnimStyle]}
          accessibilityRole={'button' as AccessibilityRole}
          accessibilityLabel="Close menu"
        />
      </GestureDetector>

      {/* Menu container — centered at bottom */}
      <View style={[styles.container, style]} pointerEvents="box-none">
        {/* Arc items */}
        {actions.map((action, index) => {
          const pos = arcPositions[index];
          if (action.holdToActivate) {
            return (
              <FocusActionItem
                key={action.id}
                item={action}
                x={pos.x}
                y={pos.y}
                expansion={expansion}
                itemSize={itemSize}
                onActivate={() => handleFocusActivate(action)}
                colors={colors}
                isDark={isDark}
                taskCount={taskCount}
                index={index}
                total={actions.length}
                isOpen={isOpen}
              />
            );
          }
          return (
            <ArcActionItem
              key={action.id}
              item={action}
              x={pos.x}
              y={pos.y}
              expansion={expansion}
              itemSize={itemSize}
              onActionPress={handleActionPress}
              colors={colors}
              isDark={isDark}
              index={index}
              total={actions.length}
              isOpen={isOpen}
            />
          );
        })}

        {/* Trigger FAB */}
        <GestureDetector gesture={triggerGesture}>
          <Animated.View
            style={[styles.trigger, triggerAnimStyle]}
            testID={testID}
            accessibilityRole={'button' as AccessibilityRole}
            accessibilityLabel="Open action menu"
          >
            <Icon
              name={triggerIcon}
              size={triggerSize * 0.43}
              color={isDark ? colors.black : colors.white}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </>
  );
});

// ── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors, isDark: boolean, triggerSize: number, bottomInset: number) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
      zIndex: 998,
    },
    container: {
      position: 'absolute',
      bottom: bottomInset + Spacing.md,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 999,
    },
    trigger: {
      width: triggerSize,
      height: triggerSize,
      borderRadius: triggerSize / 2,
      backgroundColor: isDark ? c.white : c.surfaceDark,
      justifyContent: 'center',
      alignItems: 'center',
      // Solid visible border
      borderWidth: 2.5,
      borderColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.7 : 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
  });

const createActionStyles = (c: ThemeColors, isDark: boolean, itemSize: number) =>
  StyleSheet.create({
    arcItemContainer: {
      position: 'absolute',
      alignItems: 'center',
    },
    actionCircle: {
      width: itemSize,
      height: itemSize,
      borderRadius: itemSize / 2,
      backgroundColor: isDark ? c.gray100 : c.surface,
      justifyContent: 'center',
      alignItems: 'center',
      // Solid white/dark border for visibility against tinted backdrop
      borderWidth: 2.5,
      borderColor: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.95)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.6 : 0.2,
      shadowRadius: 12,
      elevation: 8,
      overflow: 'visible',
    },
    labelPill: {
      marginTop: 8,
      backgroundColor: isDark ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    labelText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: isDark ? '#FFFFFF' : c.text,
      fontFamily: FontFamily,
      textAlign: 'center',
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isDark ? c.white : c.text,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: isDark ? c.gray100 : c.surface,
    },
    badgeText: {
      color: isDark ? c.black : c.background,
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 13,
      fontFamily: FontFamily,
    },
    focusRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: itemSize / 2,
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
    },
    progressDisc: {
      position: 'absolute',
      width: itemSize - 8,
      height: itemSize - 8,
      borderRadius: (itemSize - 8) / 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)',
    },
  });
