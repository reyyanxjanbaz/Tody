import { describe, expect, it } from 'vitest';

/**
 * Phase 0.1 — the 3 RN-only module specifiers must resolve through
 * vite.config.ts's resolve.alias to the web shims, so any ported code that
 * still imports the native package name works unmodified in the browser.
 */
describe('Phase 0.1 — RN module aliases resolve to web shims', () => {
  it('@react-native-async-storage/async-storage -> asyncStorage shim', async () => {
    const mod = await import('@react-native-async-storage/async-storage');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default.getItem).toBe('function');
    expect(typeof mod.default.setItem).toBe('function');
  });

  it('react-native-haptic-feedback -> haptics shim', async () => {
    const mod = await import('react-native-haptic-feedback');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default.trigger).toBe('function');
  });

  it('react-native-url-polyfill/auto -> empty shim (no throw on import)', async () => {
    await expect(import('react-native-url-polyfill/auto')).resolves.toBeDefined();
  });
});
