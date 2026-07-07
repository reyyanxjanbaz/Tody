import { describe, expect, it } from 'vitest';
import { transitionFor, VARIANTS } from '../../src/app/navTransitions';

describe('Phase 2.9 — navTransitions.transitionFor', () => {
  it.each([
    ['/login', 'fade'],
    ['/register', 'fade'],
    ['/', 'fade'],
    // Tab-bar destinations crossfade as peers (P4.1).
    ['/calendar', 'fade'],
    ['/habits', 'fade'],
    ['/profile', 'fade'],
    ['/archive', 'slideRight'],
    ['/settings', 'slideRight'],
    ['/process-inbox', 'slideUp'],
    ['/reality-score', 'slideUp'],
  ] as const)('%s -> %s', (path, kind) => {
    expect(transitionFor(path)).toBe(kind);
  });

  it('matches /task/:id as slideRight regardless of the id', () => {
    expect(transitionFor('/task/abc-123')).toBe('slideRight');
    expect(transitionFor('/task/')).toBe('slideRight');
  });

  it('falls back to fade for an unrecognized route', () => {
    expect(transitionFor('/some-unknown-route')).toBe('fade');
  });

  it('every TransitionKind used by ROUTE_TRANSITION has a corresponding VARIANTS entry', () => {
    for (const kind of ['fade', 'slideRight', 'slideUp', 'none'] as const) {
      expect(VARIANTS[kind]).toBeDefined();
      expect(VARIANTS[kind].initial).toBeDefined();
      expect(VARIANTS[kind].animate).toBeDefined();
      expect(VARIANTS[kind].exit).toBeDefined();
    }
  });
});
