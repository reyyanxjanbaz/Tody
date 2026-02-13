/**
 * Animation constants and spring configurations.
 * Centralised motion language for the entire app.
 *
 * Spring physics follow iOS-native feel:
 *   damping 15, stiffness 150 → snappy yet organic
 * Duration tokens:
 *   micro 200ms · transition 300ms · page 400ms
 * Stagger: 50ms per item for list enter animations.
 */

import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

// ── Spring Presets ──────────────────────────────────────────────────────────

/** Default iOS-like spring for most UI elements */
export const SPRING_CONFIG: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 1,
  overshootClamping: false,
};

/** Snappier spring for checkboxes, toggles, quick interactions */
export const SPRING_SNAPPY: WithSpringConfig = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
  overshootClamping: false,
};

/** Gentle spring for modals, overlays, page-level movements */
export const SPRING_GENTLE: WithSpringConfig = {
  damping: 18,
  stiffness: 120,
  mass: 1,
  overshootClamping: false,
};

/** Bouncy spring for celebrating (confetti, success checkmarks) */
export const SPRING_BOUNCY: WithSpringConfig = {
  damping: 8,
  stiffness: 180,
  mass: 0.9,
  overshootClamping: false,
};

/** Overdamped spring – no overshoot, for destructive actions */
export const SPRING_CRITICAL: WithSpringConfig = {
  damping: 26,
  stiffness: 170,
  mass: 1,
  overshootClamping: true,
};

// ── Timing Presets ──────────────────────────────────────────────────────────

/** Micro-interaction: 200ms easeInOutCubic */
export const TIMING_MICRO: WithTimingConfig = {
  duration: 200,
  easing: Easing.bezier(0.65, 0, 0.35, 1),
};

/** Standard transition: 300ms easeInOutCubic */
export const TIMING_TRANSITION: WithTimingConfig = {
  duration: 300,
  easing: Easing.bezier(0.65, 0, 0.35, 1),
};

/** Page-level transition: 400ms easeInOutCubic */
export const TIMING_PAGE: WithTimingConfig = {
  duration: 400,
  easing: Easing.bezier(0.65, 0, 0.35, 1),
};

/** Exit animation: 250ms easeOutExpo */
export const TIMING_EXIT: WithTimingConfig = {
  duration: 250,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

/** Enter animation: 350ms easeOutExpo */
export const TIMING_ENTER: WithTimingConfig = {
  duration: 350,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

/** Fade: 150ms linear */
export const TIMING_FADE: WithTimingConfig = {
  duration: 150,
  easing: Easing.linear,
};

// ── Gesture Thresholds ──────────────────────────────────────────────────────

/** Minimum velocity to count as a fling (px/s) */
export const FLING_VELOCITY = 500;

/** Swipe activation distance (px) */
export const SWIPE_THRESHOLD = 80;

/** Long-press activation delay (ms) */
export const LONG_PRESS_DURATION = 350;

// ── Stagger ─────────────────────────────────────────────────────────────────

/** Per-item stagger delay in list enter animations (ms) */
export const STAGGER_INTERVAL = 50;

/** Max items that get a stagger delay (after this they appear instantly) */
export const STAGGER_MAX = 12;

// ── Press Feedback ──────────────────────────────────────────────────────────

/** Scale-down factor on press (0.96 = scale to 96%) */
export const PRESS_SCALE = 0.96;

/** Delay before showing press state to avoid flashing (ms) */
export const PRESS_DELAY = 60;

// ── Layout Animation ────────────────────────────────────────────────────────

/** Shared layout transition duration */
export const LAYOUT_DURATION = 300;
