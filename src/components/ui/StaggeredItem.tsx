/**
 * Staggered FadeIn wrapper for list items.
 *
 * Wraps a child view and animates it in with:
 * - fade from 0 → 1
 * - translateY from 12 → 0
 * - staggered by index * STAGGER_INTERVAL
 *
 * Uses entering/exiting layout animations from Reanimated 3.
 */

import React from 'react';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { STAGGER_INTERVAL, STAGGER_MAX } from '../../utils/animations';

interface StaggeredItemProps {
  children: React.ReactNode;
  index: number;
}

export function StaggeredItem({ children, index }: StaggeredItemProps) {
  const delay = Math.min(index, STAGGER_MAX) * STAGGER_INTERVAL;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(300).springify().damping(18).stiffness(150)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.springify().damping(18).stiffness(150)}
    >
      {children}
    </Animated.View>
  );
}
