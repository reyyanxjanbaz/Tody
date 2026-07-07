import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { HABITS_ENABLED } from '../app/flags';

interface Tab {
  path: string;
  label: string;
  icon: string;
  activeIcon: string;
}

const TABS: Tab[] = [
  { path: '/',         label: 'Today',    icon: 'today-outline',    activeIcon: 'today' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar-outline', activeIcon: 'calendar' },
  { path: '/habits',   label: 'Habits',   icon: 'flame-outline',    activeIcon: 'flame' },
  { path: '/profile',  label: 'Profile',  icon: 'person-outline',   activeIcon: 'person' },
];

/** Routes that show the tab bar (top-level destinations only). */
export const TAB_ROUTES = new Set(['/', '/calendar', '/habits', '/profile']);

export function isTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname);
}

/**
 * Phase 4.1 — persistent bottom navigation. Before this, Calendar had a route
 * but literally no way to reach it. Four fixed destinations, ≥44px targets,
 * aria-current on the active tab. Habits is hidden behind a flag until Phase 5.
 */
export function BottomTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = TABS.filter((t) => t.path !== '/habits' || HABITS_ENABLED);

  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'flex',
        borderTop: '1px solid var(--c-border)',
        background: 'var(--c-background)',
        paddingBottom: 'var(--safe-bottom)',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => { if (!active) { haptic('selection'); navigate(tab.path); } }}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              height: 'var(--tabbar-h)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              color: active ? 'var(--c-text)' : 'var(--c-gray400)',
            }}
          >
            <motion.span
              animate={{ scale: active ? 1 : 0.94, y: active ? 0 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ display: 'flex' }}
            >
              <Icon name={active ? tab.activeIcon : tab.icon} size={23} color={active ? 'var(--c-text)' : 'var(--c-gray400)'} />
            </motion.span>
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: '0.2px' }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
