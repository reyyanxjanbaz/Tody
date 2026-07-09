import { describe, expect, it } from 'vitest';
import * as motion from '../../src/theme/motion';

/** Phase A.1 — the shared motion vocabulary. These constants are the contract
 *  every animated surface builds on, so lock their shape and sane ranges. */
describe('Phase A.1 — motion vocabulary', () => {
  it('exposes the four (and only four) allowed durations, ordered', () => {
    const { DUR_INSTANT, DUR_QUICK, DUR_SMOOTH, DUR_SLOW } = motion;
    expect(DUR_INSTANT).toBeLessThan(DUR_QUICK);
    expect(DUR_QUICK).toBeLessThan(DUR_SMOOTH);
    expect(DUR_SMOOTH).toBeLessThan(DUR_SLOW);
    // Nothing longer than the celebration ceiling.
    for (const d of [DUR_INSTANT, DUR_QUICK, DUR_SMOOTH, DUR_SLOW]) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(0.4);
    }
  });

  it('defines gentle + layout springs with no runaway overshoot', () => {
    for (const spring of [motion.SPRING_GENTLE, motion.SPRING_LAYOUT]) {
      expect(spring.type).toBe('spring');
      expect(spring.stiffness).toBeGreaterThan(0);
      expect(spring.damping).toBeGreaterThan(0);
      expect(spring.mass).toBeGreaterThan(0);
    }
    // Layout arrives quicker (stiffer) than gentle.
    expect(motion.SPRING_LAYOUT.stiffness!).toBeGreaterThan(
      motion.SPRING_GENTLE.stiffness!,
    );
  });

  it('uses the canonical ease curve shared with navTransitions', () => {
    expect(motion.EASE_OUT).toEqual([0.32, 0.72, 0, 1]);
  });

  it('caps stagger so long lists never crawl in', () => {
    expect(motion.STAGGER_FAST).toBeLessThan(motion.STAGGER_LIST);
    expect(motion.STAGGER_LIST_MAX).toBeGreaterThan(0);
    expect(motion.STAGGER_LIST_MAX).toBeLessThanOrEqual(12);
  });

  it('standard press feedback is a subtle inward scale', () => {
    expect(motion.PRESS.scale).toBeGreaterThan(0.9);
    expect(motion.PRESS.scale).toBeLessThan(1);
    expect(motion.PRESS.transition).toBe(motion.SPRING_SNAPPY);
  });

  it('list-item variants animate transform/opacity (height only on exit)', () => {
    const { initial, animate, exit } = motion.listItemVariants;
    expect(initial).toMatchObject({ opacity: 0 });
    expect(animate).toMatchObject({ opacity: 1, y: 0 });
    expect(exit).toHaveProperty('height', 0);
    // Entrance never animates height (layout thrash).
    expect(initial).not.toHaveProperty('height');
    expect(animate).not.toHaveProperty('height');
  });
});
