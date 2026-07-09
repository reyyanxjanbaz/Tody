import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(WEB_ROOT, 'index.html'), 'utf8');

describe('Phase 0.5 — index.html PWA/iOS shell', () => {
  it('boots dark by default via data-theme on <html>', () => {
    expect(html).toMatch(/<html[^>]*data-theme="dark"/);
  });

  it('has the ToDy title', () => {
    expect(html).toMatch(/<title>ToDy<\/title>/);
  });

  it('declares iOS standalone/installability meta tags', () => {
    expect(html).toMatch(/name="apple-mobile-web-app-capable"\s+content="yes"/);
    expect(html).toMatch(/name="mobile-web-app-capable"\s+content="yes"/);
    expect(html).toMatch(/name="apple-mobile-web-app-status-bar-style"/);
    expect(html).toMatch(/name="apple-mobile-web-app-title"\s+content="ToDy"/);
  });

  it('has a viewport meta with viewport-fit=cover (safe-area support)', () => {
    expect(html).toMatch(/name="viewport"[\s\S]*?viewport-fit=cover/);
  });

  it('declares theme-color and color-scheme', () => {
    expect(html).toMatch(/name="theme-color"\s+content="#000000"/);
    expect(html).toMatch(/name="color-scheme"\s+content="dark light"/);
  });

  it('links the apple-touch-icon and favicon', () => {
    expect(html).toMatch(/rel="apple-touch-icon"\s+href="\/apple-touch-icon\.png"/);
    expect(html).toMatch(/rel="icon"[^>]*href="\/favicon\.ico"/);
  });

  it('mounts the app via /src/main.tsx into #root', () => {
    expect(html).toMatch(/<div id="root">/);
    expect(html).toMatch(/<script[^>]*type="module"[^>]*src="\/src\/main\.tsx"/);
  });
});
