import { useEffect } from 'react';

/**
 * Keeps the CSS variable `--app-height` in sync with the *visual* viewport
 * height (the area actually on screen, above the soft keyboard / browser UI).
 *
 * `#root` uses `height: var(--app-height)` and `position: fixed`, so:
 *   • The app frame is always exactly the visible height — no dvh imprecision,
 *     no gap under the tab bar.
 *   • When the on-screen keyboard opens, the visual viewport shrinks; the frame
 *     shrinks with it and the flex column re-lays-out, so only the bottom input
 *     rides up above the keyboard instead of iOS scrolling the whole app up.
 *
 * iOS Safari ignores the `interactive-widget` viewport hint, so this JS path is
 * the only reliable cross-platform fix. Mount once, at the app root.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;

    const apply = () => {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
    };

    apply();

    if (vv) {
      vv.addEventListener('resize', apply);
      vv.addEventListener('scroll', apply);
    }
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', apply);
        vv.removeEventListener('scroll', apply);
      }
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
}
