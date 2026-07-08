import type { Variants, Transition } from 'framer-motion';

export type TransitionKind = 'fade' | 'slideRight' | 'slideUp' | 'none';

/** Which transition each route uses — mirrors RootNavigator screenOptions. */
export const ROUTE_TRANSITION: Record<string, TransitionKind> = {
  '/login': 'fade',
  '/register': 'fade',
  '/': 'fade',
  // Tab-bar destinations are peers → crossfade between them (P4.1).
  '/calendar': 'fade',
  '/habits': 'fade',
  '/profile': 'fade',
  '/archive': 'slideRight',
  '/settings': 'slideRight',
  '/task': 'slideRight', // /task/:id
  '/process-inbox': 'slideUp',
  '/reality-score': 'slideUp',
  '/leaderboard': 'slideUp',
};

export function transitionFor(pathname: string): TransitionKind {
  if (pathname.startsWith('/task/')) return 'slideRight';
  if (pathname.startsWith('/habits/')) return 'slideRight'; // habit detail (not the /habits tab)
  return ROUTE_TRANSITION[pathname] ?? 'fade';
}

const EASE: Transition = { duration: 0.24, ease: [0.32, 0.72, 0, 1] };
const FADE: Transition = { duration: 0.26, ease: 'easeInOut' };

export const VARIANTS: Record<TransitionKind, Variants> = {
  none: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
  },
  fade: {
    initial: { opacity: 0, transition: FADE },
    animate: { opacity: 1, transition: FADE },
    exit: { opacity: 0, transition: FADE },
  },
  slideRight: {
    initial: { x: '100%', transition: EASE },
    animate: { x: 0, transition: EASE },
    exit: { x: '100%', transition: EASE },
  },
  slideUp: {
    initial: { y: '100%', transition: EASE },
    animate: { y: 0, transition: EASE },
    exit: { y: '100%', transition: EASE },
  },
};
