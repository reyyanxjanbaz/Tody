import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../core/context/ThemeContext';
import { PreferencesProvider, usePreferences } from './PreferencesContext';
import { AuthProvider } from '../core/context/AuthContext';
import { WorkspaceProvider } from '../features/workspaces/WorkspaceContext';
import { TaskProvider } from '../core/context/TaskContext';
import { InboxProvider } from '../core/context/InboxContext';
import { HabitProvider } from '../core/context/HabitContext';
import { UndoProvider } from '../components/UndoToast';
import { CelebrationProvider } from '../components/Celebration';

/**
 * Applies web-only accessibility preferences (P4.2/P4.3): stamps
 * <html data-textsize / data-reducemotion> so CSS (zoom, transition kills) can
 * react, and drives framer-motion's global reducedMotion via MotionConfig.
 */
function PreferencesEffects({ children }: { children: ReactNode }) {
  const { webPrefs } = usePreferences();

  useEffect(() => {
    document.documentElement.dataset.textsize = webPrefs.textSize;
  }, [webPrefs.textSize]);

  useEffect(() => {
    const root = document.documentElement;
    if (webPrefs.reduceMotion === 'system') delete root.dataset.reducemotion;
    else root.dataset.reducemotion = webPrefs.reduceMotion; // 'on' | 'off'
  }, [webPrefs.reduceMotion]);

  const reducedMotion = webPrefs.reduceMotion === 'on' ? 'always'
    : webPrefs.reduceMotion === 'off' ? 'never'
    : 'user';

  return (
    <MotionConfig reducedMotion={reducedMotion}>
      <CelebrationProvider>{children}</CelebrationProvider>
    </MotionConfig>
  );
}

/**
 * Provider nesting (web):
 *   Theme → Preferences → [Effects: MotionConfig + Celebration] → Auth → Workspace → Task → Inbox → Undo
 * Preferences sits above Auth so screens and formatters can read date/time/
 * week-start settings everywhere; Theme stays outermost as the sole owner of
 * darkMode (both read-merge-write the same stored preferences object).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <PreferencesEffects>
          <AuthProvider>
            <WorkspaceProvider>
              <TaskProvider>
                <InboxProvider>
                  <HabitProvider>
                    <UndoProvider>{children}</UndoProvider>
                  </HabitProvider>
                </InboxProvider>
              </TaskProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </PreferencesEffects>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
