import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── jsdom polyfills ──────────────────────────────────────────────────────────

if (!('vibrate' in navigator)) {
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), writable: true, configurable: true });
}

if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!('ResizeObserver' in window)) {
  // @ts-expect-error jsdom has no ResizeObserver
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ── Global network mocks ─────────────────────────────────────────────────────
// Every unit/component test runs with zero network. Individual tests can
// override return values via vi.mocked(...).mockResolvedValueOnce(...).

vi.mock('../src/core/lib/supabase', () => {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
  };
  return { supabase: { auth } };
});

vi.mock('../src/core/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: null, error: null, isBackendDown: false }),
    post: vi.fn().mockResolvedValue({ data: null, error: null, isBackendDown: false }),
    patch: vi.fn().mockResolvedValue({ data: null, error: null, isBackendDown: false }),
    put: vi.fn().mockResolvedValue({ data: null, error: null, isBackendDown: false }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null, isBackendDown: false }),
  },
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
});
