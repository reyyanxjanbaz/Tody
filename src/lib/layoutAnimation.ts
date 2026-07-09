/**
 * Web replacement for React Native's LayoutAnimation.configureNext().
 *
 * On native, calling this just before a setState animates the next layout pass.
 * On web we lean on FLIP-style layout animations at the component level
 * (Framer Motion `layout` + @formkit/auto-animate on lists), so this is a
 * lightweight hook point. Components that opt into auto-animate register a
 * container ref; calling beginLayoutAnimation() is otherwise a no-op that keeps
 * the ported TaskContext byte-compatible with the native call sites.
 */

let pending = false;

/**
 * Signal that the next DOM mutation should be animated. Kept intentionally
 * cheap — the actual animation is owned by the rendering components. Returns
 * synchronously so it can sit inline before a React setState like the native API.
 */
export function beginLayoutAnimation(): void {
  pending = true;
  // Clear the flag on the next frame; a consumer may read isLayoutAnimationPending()
  // during its render to decide whether to animate.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      pending = false;
    });
  } else {
    pending = false;
  }
}

export function isLayoutAnimationPending(): boolean {
  return pending;
}
