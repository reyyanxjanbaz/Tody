import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(WEB_ROOT, 'dist');

/**
 * Phase 4.1 — build. Runs `npm run build` once for this whole file (all
 * other phase4 artifact tests read from the resulting dist/), rather than
 * per-test, since a full tsc+vite build takes a few seconds.
 */
describe('Phase 4 — build artifacts (dist/)', () => {
  beforeAll(() => {
    // Vitest sets NODE_ENV=test on itself; a child `vite build` process
    // inherits env by default, and Vite reads NODE_ENV (not just the CLI
    // command) to help resolve import.meta.env.DEV/PROD — so without this
    // override the build silently comes out dev-flavored (larger vendor
    // chunks, and — critically — the DEV-only __todyDevAuth bypass in
    // AppRouter.tsx does NOT get dead-code-eliminated). Force real prod mode.
    execFileSync('npm', ['run', 'build'], {
      cwd: WEB_ROOT,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  }, 120_000);

  it('4.1 — npm run build exits 0 and produces a dist/ directory', () => {
    expect(existsSync(DIST)).toBe(true);
    expect(existsSync(path.join(DIST, 'index.html'))).toBe(true);
  });

  describe('4.2 — code splitting', () => {
    const assetFiles = () => readdirSync(path.join(DIST, 'assets'));

    it.each([
      'HomeScreen', 'TaskDetailScreen', 'CalendarScreen', 'ArchiveScreen',
      'ProcessInboxScreen', 'RealityScoreScreen', 'ProfileScreen', 'SettingsScreen',
    ])('has a dedicated chunk for %s', (name) => {
      expect(assetFiles().some((f) => f.startsWith(name))).toBe(true);
    });

    it.each(['vendor-motion', 'vendor-supabase', 'vendor-icons', 'vendor-'])(
      'has a %s vendor chunk',
      (prefix) => {
        expect(assetFiles().some((f) => f.startsWith(prefix))).toBe(true);
      },
    );

    it('no single JS chunk exceeds 800 KB', () => {
      const jsFiles = assetFiles().filter((f) => f.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(0);
      for (const f of jsFiles) {
        const size = statSync(path.join(DIST, 'assets', f)).size;
        expect(size, `${f} is ${size} bytes`).toBeLessThan(800 * 1024);
      }
    });
  });

  describe('4.3 — manifest.webmanifest', () => {
    const manifest = () => JSON.parse(readFileSync(path.join(DIST, 'manifest.webmanifest'), 'utf8'));

    it('is valid JSON with the required PWA fields', () => {
      const m = manifest();
      expect(m.display).toBe('standalone');
      expect(m.start_url).toBe('/');
      expect(m.theme_color).toBe('#000000');
      expect(m.background_color).toBe('#000000');
      expect(m.name).toMatch(/^ToDy/);
      expect(m.short_name).toBe('ToDy');
    });

    it('includes 192/512/maskable-512 icons', () => {
      const icons: Array<{ src: string; sizes: string; purpose?: string }> = manifest().icons;
      expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
      expect(icons.some((i) => i.sizes === '512x512' && !i.purpose)).toBe(true);
      expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
    });
  });

  describe('4.4 — service worker (dist/sw.js)', () => {
    const swSrc = () => readFileSync(path.join(DIST, 'sw.js'), 'utf8');

    it('exists', () => {
      expect(existsSync(path.join(DIST, 'sw.js'))).toBe(true);
    });

    it('precaches index.html, hashed JS/CSS assets, and font files', () => {
      const sw = swSrc();
      expect(sw).toContain('"index.html"');
      expect(sw).toMatch(/assets\/index-[\w-]+\.js/);
      expect(sw).toMatch(/assets\/index-[\w-]+\.css/);
      expect(sw).toMatch(/fonts\/CharisSIL-Regular\.ttf/);
    });

    it('registers a navigateFallback route to index.html', () => {
      expect(swSrc()).toContain('NavigationRoute');
    });

    it('registers a NetworkFirst runtime-cache rule for the Supabase + Render API origins', () => {
      const sw = swSrc();
      expect(sw).toContain('NetworkFirst');
      expect(sw).toContain('supabase');
      expect(sw).toContain('onrender'); // the compiled regex escapes the literal dot
    });
  });

  describe('4.8 — DEV-only auth bypass is stripped from the production bundle', () => {
    it('no built JS asset contains the __todyDevAuth string', () => {
      const assetsDir = path.join(DIST, 'assets');
      for (const f of readdirSync(assetsDir).filter((f) => f.endsWith('.js'))) {
        const content = readFileSync(path.join(assetsDir, f), 'utf8');
        expect(content, `${f} must not reference __todyDevAuth`).not.toContain('__todyDevAuth');
      }
    });
  });

  describe('4.9 — deploy config', () => {
    it('vercel.json is valid JSON with an SPA rewrite and a cached-immutable rule for hashed assets', () => {
      const vercelJson = JSON.parse(readFileSync(path.join(WEB_ROOT, 'vercel.json'), 'utf8'));
      expect(vercelJson.rewrites).toEqual(
        expect.arrayContaining([expect.objectContaining({ destination: '/index.html' })]),
      );
      const swHeader = vercelJson.headers.find((h: any) => h.source === '/sw.js');
      expect(swHeader).toBeDefined();
      expect(swHeader.headers.some((h: any) => h.key === 'Service-Worker-Allowed')).toBe(true);
    });

    it('public/_redirects falls back every route to index.html (Netlify-style SPA hosting)', () => {
      const redirects = readFileSync(path.join(WEB_ROOT, 'public/_redirects'), 'utf8');
      expect(redirects).toMatch(/\/\*\s+\/index\.html\s+200/);
    });
  });
});
