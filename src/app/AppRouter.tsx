import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../core/context/AuthContext';
import { Spinner } from '../ui/Spinner';
import { AppShell } from './AppShell';
import { transitionFor, VARIANTS } from './navTransitions';
import { BottomTabBar, isTabRoute } from '../components/BottomTabBar';
import { useKeyboardOpen } from '../utils/useKeyboardOpen';
import { useViewportHeight } from '../utils/useViewportHeight';

// Auth screens are eager (first paint); the rest are code-split per route.
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
const HomeScreen = lazy(() => import('../screens/HomeScreen').then((m) => ({ default: m.HomeScreen })));
const CalendarScreen = lazy(() => import('../screens/CalendarScreen').then((m) => ({ default: m.CalendarScreen })));
const ArchiveScreen = lazy(() => import('../screens/ArchiveScreen').then((m) => ({ default: m.ArchiveScreen })));
const TaskDetailScreen = lazy(() => import('../screens/TaskDetailScreen').then((m) => ({ default: m.TaskDetailScreen })));
const ProcessInboxScreen = lazy(() => import('../screens/ProcessInboxScreen').then((m) => ({ default: m.ProcessInboxScreen })));
const RealityScoreScreen = lazy(() => import('../screens/RealityScoreScreen').then((m) => ({ default: m.RealityScoreScreen })));
const ProfileScreen = lazy(() => import('../screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen })));
const HabitsScreen = lazy(() => import('../screens/HabitsScreen').then((m) => ({ default: m.HabitsScreen })));
const HabitDetailScreen = lazy(() => import('../screens/HabitDetailScreen').then((m) => ({ default: m.HabitDetailScreen })));
const SettingsScreen = lazy(() => import('../screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const LeaderboardScreen = lazy(() => import('../features/social/LeaderboardScreen').then((m) => ({ default: m.LeaderboardScreen })));
const SocialHubScreen = lazy(() => import('../features/social/SocialHubScreen').then((m) => ({ default: m.SocialHubScreen })));
const AcceptInviteScreen = lazy(() => import('../features/social/AcceptInviteScreen').then((m) => ({ default: m.AcceptInviteScreen })));
const PactDetailScreen = lazy(() => import('../features/pacts/PactDetailScreen').then((m) => ({ default: m.PactDetailScreen })));
import { PendingInviteRedeemer } from '../features/social/AcceptInviteScreen';

const pageStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--c-background)',
  willChange: 'transform, opacity',
};

const centered: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function pageKey(pathname: string): string {
  if (pathname.startsWith('/task/')) return '/task';
  if (pathname.startsWith('/habits/')) return '/habits/detail';
  if (pathname.startsWith('/pacts/')) return '/pacts/detail';
  if (pathname.startsWith('/invite/')) return '/invite';
  return pathname;
}

function AnimatedRoutes() {
  const location = useLocation();
  const { user } = useAuth();
  const kind = transitionFor(location.pathname);
  useViewportHeight();
  const keyboardOpen = useKeyboardOpen();
  // DEV-only: render the authed app without a live session (offline verification).
  const authed = !!user || (import.meta.env.DEV && localStorage.getItem('__todyDevAuth') === '1');
  // Hide the tab bar while the soft keyboard is up so the focused input (e.g. the
  // add-task bar) sits directly above the keyboard instead of behind the tabs.
  const showTabs = authed && isTabRoute(location.pathname) && !keyboardOpen;

  return (
    <AppShell bottomBar={showTabs ? <BottomTabBar /> : undefined}>
      {authed && <PendingInviteRedeemer />}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={pageKey(location.pathname)}
          variants={VARIANTS[kind]}
          initial="initial"
          animate="animate"
          exit="exit"
          style={pageStyle}
        >
          <Suspense fallback={<div style={centered}><Spinner size={22} color="var(--c-text)" /></div>}>
            <Routes location={location}>
              {authed ? (
                <>
                  <Route path="/" element={<HomeScreen />} />
                  <Route path="/calendar" element={<CalendarScreen />} />
                  <Route path="/archive" element={<ArchiveScreen />} />
                  <Route path="/task/:id" element={<TaskDetailScreen />} />
                  <Route path="/process-inbox" element={<ProcessInboxScreen />} />
                  <Route path="/reality-score" element={<RealityScoreScreen />} />
                  <Route path="/profile" element={<ProfileScreen />} />
                  <Route path="/habits" element={<HabitsScreen />} />
                  <Route path="/habits/:id" element={<HabitDetailScreen />} />
                  <Route path="/settings" element={<SettingsScreen />} />
                  <Route path="/social" element={<SocialHubScreen />} />
                  <Route path="/leaderboard" element={<LeaderboardScreen />} />
                  <Route path="/pacts/:id" element={<PactDetailScreen />} />
                  <Route path="/invite/:code" element={<AcceptInviteScreen />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              ) : (
                <>
                  <Route path="/login" element={<LoginScreen />} />
                  <Route path="/register" element={<RegisterScreen />} />
                  {/* Reachable logged-out: captures the code, then bounces to /register. */}
                  <Route path="/invite/:code" element={<AcceptInviteScreen />} />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </>
              )}
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

export function AppRouter() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div style={centered}><Spinner size={22} color="var(--c-text)" /></div>;
  }

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
