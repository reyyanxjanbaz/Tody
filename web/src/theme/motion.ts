/**
 * Motion language — web port of src/utils/animations.ts.
 * Reanimated spring configs map 1:1 onto Framer Motion spring transitions
 * (both use stiffness / damping / mass).
 */
import type { Transition } from 'framer-motion';

/** Snappy — checkboxes, toggles, quick presses */
export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

/** Bouncy — success checkmarks / celebrations */
export const SPRING_BOUNCY: Transition = {
  type: 'spring',
  damping: 8,
  stiffness: 180,
  mass: 0.9,
};

/** Critical — overdamped, destructive actions (no overshoot) */
export const SPRING_CRITICAL: Transition = {
  type: 'spring',
  damping: 26,
  stiffness: 170,
  mass: 1,
};

/** Fade — 150ms linear */
export const TIMING_FADE: Transition = { duration: 0.15, ease: 'linear' };

// Gesture thresholds (px / px·s⁻¹)
export const FLING_VELOCITY = 500;
export const SWIPE_THRESHOLD = 80;

// Stagger
export const STAGGER_INTERVAL = 0.05; // seconds
export const STAGGER_MAX = 12;

/** Scale-down factor on press */
export const PRESS_SCALE = 0.95;
