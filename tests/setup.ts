import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── Storage polyfill ─────────────────────────────────────────────────────────
// Node 22+ (default in Node 24/25) ships an experimental built-in `localStorage`
// global that shadows jsdom's. It's backed by `--localstorage-file` and, without
// one, is non-functional (`localStorage.clear` throws "is not a function"), which
// takes down the entire suite at the `beforeEach` below. Install a real in-memory
// Storage so tests get a reliable, spec-compliant localStorage regardless of the
// Node/jsdom/Vitest combination.
// Real localStorage exposes stored keys as own enumerable properties (so
// `Object.keys(localStorage)` / bracket access work — the AsyncStorage shim's
// getAllKeys relies on this). A Proxy reflects the backing Map's keys as own
// properties while keeping the Storage methods on the target.
function makeStorage(): Storage {
  const data = new Map<string, string>();
  const methods = {
    get length() { return data.size; },
    clear() { data.clear(); },
    getItem(k: string) { return data.has(k) ? data.get(k)! : null; },
    setItem(k: string, v: string) { data.set(String(k), String(v)); },
    removeItem(k: string) { data.delete(k); },
    key(i: number) { return Array.from(data.keys())[i] ?? null; },
  };
  return new Proxy(methods, {
    get(target, prop) {
      if (prop in target) return (target as Record<PropertyKey, unknown>)[prop];
      const k = String(prop);
      return data.has(k) ? data.get(k) : undefined;
    },
    set(target, prop, value) {
      if (prop in target) return false;
      data.set(String(prop), String(value));
      return true;
    },
    has(target, prop) { return prop in target || data.has(String(prop)); },
    deleteProperty(_target, prop) { data.delete(String(prop)); return true; },
    ownKeys() { return Array.from(data.keys()); },
    getOwnPropertyDescriptor(_target, prop) {
      const k = String(prop);
      if (!data.has(k)) return undefined;
      return { enumerable: true, configurable: true, writable: true, value: data.get(k) };
    },
  }) as unknown as Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const impl = makeStorage();
  Object.defineProperty(globalThis, name, { value: impl, writable: true, configurable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, { value: impl, writable: true, configurable: true });
  }
}

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
