import type { ReactNode } from 'react';
import { ThemeProvider } from '../../src/core/context/ThemeContext';
import { AuthProvider } from '../../src/core/context/AuthContext';

/** Minimal provider stack (Theme -> Auth) needed by Task/Inbox context tests. */
export function AuthedShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
