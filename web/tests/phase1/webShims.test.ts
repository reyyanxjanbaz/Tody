import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginLayoutAnimation, isLayoutAnimationPending } from '../../src/lib/layoutAnimation';
import { Alert, setAlertHandler } from '../../src/lib/alert';

describe('Phase 1.10 — web replacements for RN LayoutAnimation / Alert', () => {
  afterEach(() => {
    setAlertHandler(null);
    vi.restoreAllMocks();
  });

  it('beginLayoutAnimation is a no-throw, synchronous no-op hook', () => {
    expect(() => beginLayoutAnimation()).not.toThrow();
  });

  it('beginLayoutAnimation flags pending until the next animation frame clears it', async () => {
    beginLayoutAnimation();
    expect(isLayoutAnimationPending()).toBe(true);
    await new Promise(requestAnimationFrame);
    expect(isLayoutAnimationPending()).toBe(false);
  });

  it('Alert.alert routes to a registered handler when one is set', () => {
    const handler = vi.fn();
    setAlertHandler(handler);
    Alert.alert('Title', 'Message');
    expect(handler).toHaveBeenCalledWith('Title', 'Message');
  });

  it('Alert.alert falls back to window.alert when no handler is registered', () => {
    const spy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    Alert.alert('Title', 'Message');
    expect(spy).toHaveBeenCalledWith('Title\n\nMessage');
  });

  it('Alert.alert with just a title omits the blank message line', () => {
    const spy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    Alert.alert('Just a title');
    expect(spy).toHaveBeenCalledWith('Just a title');
  });
});
