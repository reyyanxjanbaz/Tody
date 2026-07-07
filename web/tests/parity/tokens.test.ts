import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Phase 1 parity gate for the one file that was deliberately rewritten
 * (native's colors.ts imports react-native's StyleSheet/Platform, which does
 * not exist in the web project). Since we can't import the native module
 * directly, we extract the token values textually from both source files and
 * assert the actual design values (hex colors, spacing, radii) are identical
 * — only the RN plumbing around them was allowed to change.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '../..');
const NATIVE_ROOT = path.resolve(WEB_ROOT, '..');

const nativeSrc = readFileSync(path.join(NATIVE_ROOT, 'src/utils/colors.ts'), 'utf8');
const webSrc = readFileSync(path.join(WEB_ROOT, 'src/core/utils/colors.ts'), 'utf8');

/** Extracts `export const <name> = { ... }` as a flat key -> value(string) map, brace-balanced. */
function extractObject(src: string, name: string): Record<string, string> {
  const marker = `export const ${name} = {`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`could not find "${marker}"`);
  const bodyStart = start + marker.length;
  let depth = 1;
  let i = bodyStart;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
  }
  const body = src.slice(bodyStart, i - 1);

  const entries: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = /^\s*(\w+):\s*(.+?),?\s*$/.exec(line);
    if (!m) continue;
    entries[m[1]] = m[2].replace(/,$/, '');
  }
  return entries;
}

describe('Phase 1 parity — colors.ts design tokens are value-identical to native', () => {
  it.each(['LightColors', 'DarkColors'])('%s hex values match native', (name) => {
    const native = extractObject(nativeSrc, name);
    const web = extractObject(webSrc, name);
    expect(Object.keys(web).sort()).toEqual(Object.keys(native).sort());
    for (const key of Object.keys(native)) {
      expect(web[key], `${name}.${key}`).toBe(native[key]);
    }
  });

  it.each(['BorderRadius', 'Spacing'])('%s numeric values match native', (name) => {
    const native = extractObject(nativeSrc, name);
    const web = extractObject(webSrc, name);
    expect(web).toEqual(native);
  });

  it('LightColors has no keys that collide with DarkColors value drift (sanity)', () => {
    const light = extractObject(webSrc, 'LightColors');
    const dark = extractObject(webSrc, 'DarkColors');
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });
});
