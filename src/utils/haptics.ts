/**
 * Haptic feedback utility.
 *
 * Wraps react-native-haptic-feedback with a simplified API:
 *   haptic('light')   – taps, small UI changes
 *   haptic('medium')  – swipe actions, checkboxes
 *   haptic('heavy')   – errors, destructive actions
 *   haptic('success') – task completed
 *   haptic('warning') – validation errors
 *   haptic('error')   – network/critical errors
 *
 * Falls back silently on Android < 8 / iOS with haptics disabled.
 */

import { Platform } from 'react-native';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

type HapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

const MAP: Record<HapticStyle, HapticFeedbackTypes> = {
  light: HapticFeedbackTypes.impactLight,
  medium: HapticFeedbackTypes.impactMedium,
  heavy: HapticFeedbackTypes.impactHeavy,
  selection: HapticFeedbackTypes.selection,
  success: HapticFeedbackTypes.notificationSuccess,
  warning: HapticFeedbackTypes.notificationWarning,
  error: HapticFeedbackTypes.notificationError,
};

/**
 * Trigger haptic feedback.
 * Safe to call on any platform – no-ops gracefully.
 */
export function haptic(style: HapticStyle = 'light'): void {
  try {
    ReactNativeHapticFeedback.trigger(MAP[style], options);
  } catch {
    // Silently ignore on unsupported devices
  }
}
