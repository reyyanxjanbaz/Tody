import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateServiceWorker = vi.fn();
let offlineReady = false;
let needRefresh = false;
const setOfflineReady = vi.fn((v: boolean) => { offlineReady = v; });
const setNeedRefresh = vi.fn((v: boolean) => { needRefresh = v; });

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  }),
}));

// Imported after the mock so the component picks up the mocked virtual module.
const { PWAUpdatePrompt } = await import('../../src/components/PWAUpdatePrompt');

describe('Phase 4.7 — PWAUpdatePrompt', () => {
  beforeEach(() => {
    offlineReady = false;
    needRefresh = false;
    updateServiceWorker.mockClear();
    setOfflineReady.mockClear();
    setNeedRefresh.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it('renders nothing when neither offlineReady nor needRefresh is set', () => {
    render(<PWAUpdatePrompt />);
    expect(screen.queryByText(/version|offline/i)).not.toBeInTheDocument();
  });

  it('shows "Ready to work offline" when offlineReady is true', () => {
    offlineReady = true;
    render(<PWAUpdatePrompt />);
    expect(screen.getByText('Ready to work offline.')).toBeInTheDocument();
    expect(screen.queryByText('Reload')).not.toBeInTheDocument();
  });

  it('shows the "new version" banner with a Reload button when needRefresh is true', async () => {
    needRefresh = true;
    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);
    expect(screen.getByText('A new version is available.')).toBeInTheDocument();
    await user.click(screen.getByText('Reload'));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('Dismiss clears both offlineReady and needRefresh', async () => {
    needRefresh = true;
    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);
    await user.click(screen.getByText('Dismiss'));
    expect(setOfflineReady).toHaveBeenCalledWith(false);
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
