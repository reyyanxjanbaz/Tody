import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactNativeHapticFeedback, { HapticFeedbackTypes } from '../../src/shims/haptics';

describe('Phase 1.3 — haptics shim (Vibration API)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exposes all 7 native haptic types', () => {
    expect(Object.keys(HapticFeedbackTypes).sort()).toEqual(
      [
        'impactLight',
        'impactMedium',
        'impactHeavy',
        'selection',
        'notificationSuccess',
        'notificationWarning',
        'notificationError',
      ].sort(),
    );
  });

  it('trigger() calls navigator.vibrate with a pattern for a known type', () => {
    const spy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true);
    ReactNativeHapticFeedback.trigger('impactHeavy');
    expect(spy).toHaveBeenCalledWith(24);
  });

  it('trigger() maps notification types to a multi-pulse pattern array', () => {
    const spy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true);
    ReactNativeHapticFeedback.trigger('notificationError');
    expect(spy).toHaveBeenCalledWith([24, 40, 24, 40, 24]);
  });

  it('trigger() defaults to "selection" when called with no args', () => {
    const spy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true);
    ReactNativeHapticFeedback.trigger();
    expect(spy).toHaveBeenCalledWith(6);
  });

  it('trigger() no-ops without throwing when vibrate is unsupported', () => {
    const original = navigator.vibrate;
    // @ts-expect-error simulate iOS Safari with no Vibration API
    delete navigator.vibrate;
    expect(() => ReactNativeHapticFeedback.trigger('selection')).not.toThrow();
    navigator.vibrate = original;
  });
});
