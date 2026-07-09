/**
 * Animation constants and spring configurations.
 * Centralised motion language for the entire app.
 */

import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

// ── Spring Presets ──────────────────────────────────────────────────────────

/** Snappy spring for checkboxes, toggles, quick interactions */
export const SPRING_SNAPPY: WithSpringConfig = {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
    overshootClamping: false,
};

/** Bouncy spring for success checkmarks */
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

// ── Stagger ─────────────────────────────────────────────────────────────────

/** Per-item stagger delay in list enter animations (ms) */
export const STAGGER_INTERVAL = 50;

/** Max items that get a stagger delay */
export const STAGGER_MAX = 12;

// ── Press Feedback ──────────────────────────────────────────────────────────

/** Scale-down factor on press */
export const PRESS_SCALE = 0.95;
