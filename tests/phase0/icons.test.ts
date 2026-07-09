import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(WEB_ROOT, 'public');

/** Reads width/height straight out of a PNG's IHDR chunk (bytes 16-23). */
function pngDimensions(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('Phase 0.3 — PWA icon assets', () => {
  it.each([
    ['icons/icon-192.png', 192, 192],
    ['icons/icon-512.png', 512, 512],
    ['icons/icon-maskable-512.png', 512, 512],
  ])('%s exists, is non-empty, and is %dx%d', (rel, width, height) => {
    const file = path.join(PUBLIC, rel);
    expect(existsSync(file), file).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(0);
    expect(pngDimensions(file)).toEqual({ width, height });
  });

  it('apple-touch-icon.png exists and is non-empty', () => {
    const file = path.join(PUBLIC, 'apple-touch-icon.png');
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(0);
  });

  it('favicon.ico exists and is non-empty', () => {
    const file = path.join(PUBLIC, 'favicon.ico');
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(0);
  });
});
