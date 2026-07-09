import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppProviders } from '../../src/app/AppProviders';
import { AppRouter } from '../../src/app/AppRouter';

/**
 * Phase 2.10 — route gating. AppRouter hardcodes BrowserRouter, so we drive
 * the initial path via history.pushState (jsdom supports the History API)
 * rather than swapping in a MemoryRouter. Auth state is real (AuthContext +
 * mocked supabase from tests/setup.ts resolves no session), and the
 * DEV-only `__todyDevAuth` localStorage bypass stands in for "logged in"
 * since AppRouter itself checks `import.meta.env.DEV && localStorage...`.
 */
function goTo(path: string) {
  window.history.pushState({}, '', path);
}

describe('Phase 2.10 — router gating', () => {
  beforeEach(() => {
    localStorage.clear();
    goTo('/');
  });
  afterEach(() => {
    goTo('/');
  });

  it('unauthenticated: root path redirects to the Login screen', async () => {
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText('ToDy')).toBeInTheDocument());
    expect(window.location.pathname).toBe('/login');
  });

  it('unauthenticated: an unknown path redirects to Login', async () => {
    goTo('/some-unknown-path');
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('unauthenticated: /register renders the Register screen directly (no redirect)', async () => {
    goTo('/register');
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );
    await waitFor(() => expect(window.location.pathname).toBe('/register'));
  });

  it('authenticated (DEV bypass): root path renders Home ("Today")', async () => {
    localStorage.setItem('__todyDevAuth', '1');
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText('Today')).toBeInTheDocument(), { timeout: 3000 });
    expect(window.location.pathname).toBe('/');
  });

  it('authenticated (DEV bypass): an unknown path redirects to Home', async () => {
    localStorage.setItem('__todyDevAuth', '1');
    goTo('/some-unknown-path');
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );
    await waitFor(() => expect(window.location.pathname).toBe('/'), { timeout: 3000 });
  });

  it('authenticated (DEV bypass): /settings renders the Settings screen', async () => {
    localStorage.setItem('__todyDevAuth', '1');
    goTo('/settings');
    render(
      <AppProviders>
        <AppRouter />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument(), { timeout: 3000 });
  });
});
