/**
 * Web shim for react-native-haptic-feedback.
 *
 * Maps haptic intents onto the Web Vibration API where available
 * (Android Chrome). iOS Safari has no Vibration API → graceful no-op.
 * Exposes the same default export + HapticFeedbackTypes named export so
 * core/utils/haptics.ts works unchanged.
 *
 * Wired via a Vite resolve.alias.
 */

export const HapticFeedbackTypes = {
  impactLight: 'impactLight',
  impactMedium: 'impactMedium',
  impactHeavy: 'impactHeavy',
  selection: 'selection',
  notificationSuccess: 'notificationSuccess',
  notificationWarning: 'notificationWarning',
  notificationError: 'notificationError',
} as const;

export type HapticFeedbackTypes =
  (typeof HapticFeedbackTypes)[keyof typeof HapticFeedbackTypes];

// Vibration patterns (ms) approximating each intent.
const PATTERN: Record<string, number | number[]> = {
  impactLight: 8,
  impactMedium: 14,
  impactHeavy: 24,
  selection: 6,
  notificationSuccess: [10, 40, 10],
  notificationWarning: [16, 60, 16],
  notificationError: [24, 40, 24, 40, 24],
};

function trigger(type: string = 'selection', _options?: unknown): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERN[type] ?? 8);
    }
  } catch {
    /* unsupported — no-op */
  }
}

const ReactNativeHapticFeedback = { trigger };

export default ReactNativeHapticFeedback;
