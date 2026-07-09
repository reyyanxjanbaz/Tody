import { useEffect, useState } from 'react';

/**
 * True while the on-screen (soft) keyboard is open on mobile.
 *
 * Detected via the VisualViewport API: when the keyboard opens it shrinks the
 * visual viewport well below the layout viewport (window.innerHeight). We treat
 * a shrink past ~15% of the window height as "keyboard open" — large enough to
 * ignore browser-chrome jitter, small enough to catch every real keyboard.
 *
 * Used to hide the bottom tab bar while typing so the input sits directly above
 * the keyboard (paired with `interactive-widget=resizes-content` in index.html,
 * which shrinks the layout viewport rather than shoving the whole frame up).
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return; // unsupported (e.g. desktop) → never "open"

    const check = () => {
      // Gap between the layout viewport and the visual viewport. Positive and
      // large ⇒ something (the keyboard) is covering the bottom of the screen.
      const gap = window.innerHeight - vv.height;
      setOpen(gap > window.innerHeight * 0.15);
    };

    check();
    vv.addEventListener('resize', check);
    return () => vv.removeEventListener('resize', check);
  }, []);

  return open;
}
