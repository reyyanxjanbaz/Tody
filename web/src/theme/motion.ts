/**
 * Motion language — web port of src/utils/animations.ts.
 * Reanimated spring configs map 1:1 onto Framer Motion spring transitions
 * (both use stiffness / damping / mass).
 *
 * Rules for the whole app (keep motion feeling like one system):
 *  - Animate transform / opacity only. `height` is allowed only on the exit of
 *    small list items (row collapse), never on large containers.
 *  - Shared-element continuity uses Framer `layoutId` — NOT the View Transitions
 *    API, which fights `AnimatePresence mode="popLayout"` in the router.
 *  - Every meaningful motion goes through `motion.*` so it inherits
 *    `MotionConfig reducedMotion` from AppProviders. Do not hand-roll CSS
 *    keyframe animations for meaningful motion (decorative CSS pulses must be
 *    disabled under `prefers-reduced-motion` / `[data-reducemotion]`).
 *  - Entrance staggers fire on a screen's first mount only (`initial={false}`
 *    after hydration); never re-stagger on filter/sort changes. Never stagger
 *    items that scroll into a virtualized window.
 *  - Only the four DUR_* durations below are allowed for timing-based motion.
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

/**
 * Gentle — sheets, page elements, anything that "settles" into place.
 * Slightly softer than SNAPPY, no overshoot to speak of.
 */
export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 1,
};

/**
 * Layout — list reflow and `layoutId` shared-element moves. Tuned to arrive
 * quickly without visible wobble so reordering reads as "settling", not bouncing.
 */
export const SPRING_LAYOUT: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 34,
  mass: 0.9,
};

// Durations (seconds) — the only four allowed for timing-based motion.
export const DUR_INSTANT = 0.12; // hover / press feedback
export const DUR_QUICK = 0.2; // micro-transitions, small fades
export const DUR_SMOOTH = 0.28; // page / sheet / list moves
export const DUR_SLOW = 0.4; // celebrations / one-off hero moments only

/** Canonical easing curve — matches navTransitions EASE. */
export const EASE_OUT = [0.32, 0.72, 0, 1] as const;

// Gesture thresholds (px / px·s⁻¹)
export const FLING_VELOCITY = 500;
export const SWIPE_THRESHOLD = 80;

// Stagger
export const STAGGER_INTERVAL = 0.05; // seconds (legacy default)
export const STAGGER_MAX = 12;
export const STAGGER_FAST = 0.03; // pills / chips
export const STAGGER_LIST = 0.04; // list entrance
export const STAGGER_LIST_MAX = 8; // beyond this, items appear instantly

/** Standard list-item entrance/exit variants (transform + opacity + row collapse). */
export const listItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, height: 0 },
} as const;

/** Scale-down factor on press (icons / small controls). */
export const PRESS_SCALE = 0.95;

/** Standard `whileTap` for pressable surfaces (cards, rows, buttons). */
export const PRESS = { scale: 0.97, transition: SPRING_SNAPPY } as const;
