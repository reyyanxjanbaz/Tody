import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../../src/core/context/ThemeContext';
import { getUserPreferences } from '../../src/core/utils/storage';

function Probe() {
  const { isDark, colors, fontFamily, toggleTheme, resetTheme } = useTheme();
  return (
    <div>
      <span data-testid="mode">{isDark ? 'dark' : 'light'}</span>
      <span data-testid="bg">{colors.background}</span>
      <span data-testid="font">{fontFamily}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={resetTheme}>reset</button>
    </div>
  );
}

describe('Phase 1.5 — ThemeContext', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to dark mode for a first-time user and seeds preferences', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(await getUserPreferences()).toMatchObject({ darkMode: true });
  });

  it('exposes the CharisSIL font family', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('font')).toHaveTextContent('CharisSIL'));
  });

  it('toggleTheme flips mode, updates <html> dataset, and persists', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));

    await user.click(screen.getByText('toggle'));

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    await waitFor(async () => {
      expect(await getUserPreferences()).toMatchObject({ darkMode: false });
    });
  });

  it('toggling updates the color palette (dark vs light background)', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
    const darkBg = screen.getByTestId('bg').textContent;

    await user.click(screen.getByText('toggle'));
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));
    const lightBg = screen.getByTestId('bg').textContent;

    expect(darkBg).not.toBe(lightBg);
  });

  it('resetTheme forces light mode (used on logout)', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));

    await act(async () => {
      await user.click(screen.getByText('reset'));
    });

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));
  });

  it('respects a previously persisted light-mode preference on mount', async () => {
    await saveThenReload();

    async function saveThenReload() {
      const { saveUserPreferences } = await import('../../src/core/utils/storage');
      await saveUserPreferences({ darkMode: false, dateFormat: 'MM/DD/YYYY', timeFormat: '12h', weekStartsOn: 'sunday' });
    }

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));
  });

  it('renders nothing until the persisted preference has loaded (no theme flash)', () => {
    const { container } = render(<ThemeProvider><Probe /></ThemeProvider>);
    // Synchronously right after mount, the async storage read hasn't resolved yet.
    expect(container).toBeEmptyDOMElement();
  });
});
