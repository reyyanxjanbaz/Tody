import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pressable } from '../../src/ui/Pressable';

describe('Phase 2.2 — Pressable', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls onPress on click', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Pressable onPress={onPress}>tap me</Pressable>);
    await user.click(screen.getByText('tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires a haptic on pointerdown by default', () => {
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true);
    render(<Pressable onPress={() => {}}>go</Pressable>);
    screen.getByText('go').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(vibrateSpy).toHaveBeenCalled();
  });

  it('suppresses the haptic when hapticStyle is null', () => {
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true);
    render(<Pressable onPress={() => {}} hapticStyle={null}>go</Pressable>);
    screen.getByText('go').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('disabled blocks onPress and applies the disabled HTML attribute', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Pressable onPress={onPress} disabled>go</Pressable>);
    const btn = screen.getByText('go');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  describe('long-press', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('fires onLongPress after the configured delay (default 350ms) and suppresses the trailing click', () => {
      const onPress = vi.fn();
      const onLongPress = vi.fn();
      render(<Pressable onPress={onPress} onLongPress={onLongPress}>hold</Pressable>);
      const btn = screen.getByText('hold');

      btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      vi.advanceTimersByTime(350);
      expect(onLongPress).toHaveBeenCalledTimes(1);

      // The click event that a real long-press gesture trails with must not
      // also fire the short-press handler.
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('does not fire onLongPress if released before the delay elapses', () => {
      const onLongPress = vi.fn();
      render(<Pressable onPress={() => {}} onLongPress={onLongPress}>hold</Pressable>);
      const btn = screen.getByText('hold');

      btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      vi.advanceTimersByTime(200);
      btn.dispatchEvent(new Event('pointerup', { bubbles: true }));
      vi.advanceTimersByTime(200);

      expect(onLongPress).not.toHaveBeenCalled();
    });
  });
});
