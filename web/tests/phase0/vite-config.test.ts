import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(path.join(WEB_ROOT, 'vite.config.ts'), 'utf8');

describe('Phase 0.2 — vite.config.ts', () => {
  it('aliases @ and @core to src and src/core', () => {
    expect(src).toMatch(/'@':\s*r\('\.\/src'\)/);
    expect(src).toMatch(/'@core':\s*r\('\.\/src\/core'\)/);
  });

  it('aliases all 3 RN-only specifiers to shims', () => {
    expect(src).toMatch(/'@react-native-async-storage\/async-storage':\s*r\('\.\/src\/shims\/asyncStorage\.ts'\)/);
    expect(src).toMatch(/'react-native-haptic-feedback':\s*r\('\.\/src\/shims\/haptics\.ts'\)/);
    expect(src).toMatch(/'react-native-url-polyfill\/auto':\s*r\('\.\/src\/shims\/empty\.ts'\)/);
  });

  it('manualChunks is a function (Vite 8 / Rolldown requires this, not an object)', () => {
    expect(src).toMatch(/manualChunks\(id: string\)/);
  });

  it('splits vendor chunks for motion/gesture, supabase, and icons', () => {
    expect(src).toMatch(/vendor-motion/);
    expect(src).toMatch(/vendor-supabase/);
    expect(src).toMatch(/vendor-icons/);
  });

  it('registers the VitePWA plugin with registerType "prompt"', () => {
    expect(src).toMatch(/VitePWA\(/);
    expect(src).toMatch(/registerType:\s*'prompt'/);
  });

  it('manifest declares standalone display, theme/background color, and required fields', () => {
    expect(src).toMatch(/display:\s*'standalone'/);
    expect(src).toMatch(/theme_color:\s*'#000000'/);
    expect(src).toMatch(/background_color:\s*'#000000'/);
    expect(src).toMatch(/start_url:\s*'\/'/);
    expect(src).toMatch(/name:\s*'ToDy/);
    expect(src).toMatch(/short_name:\s*'ToDy'/);
  });

  it('manifest declares 3 icons including a maskable 512', () => {
    expect(src).toMatch(/icon-192\.png/);
    expect(src).toMatch(/icon-512\.png/);
    expect(src).toMatch(/icon-maskable-512\.png/);
    expect(src).toMatch(/purpose:\s*'maskable'/);
  });

  it('workbox has navigateFallback to index.html and runtime caching for the API origins', () => {
    expect(src).toMatch(/navigateFallback:\s*'\/index\.html'/);
    expect(src).toContain('supabase');
    expect(src).toContain('onrender');
    expect(src).toMatch(/handler:\s*'NetworkFirst'/);
  });

  it('devOptions disables the SW during dev (avoids stale-cache dev confusion)', () => {
    expect(src).toMatch(/devOptions:\s*\{\s*enabled:\s*false\s*\}/);
  });
});
