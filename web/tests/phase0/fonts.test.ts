import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Phase 0.4 — CharisSIL font assets', () => {
  it.each([
    'CharisSIL-Regular.ttf',
    'CharisSIL-Bold.ttf',
    'CharisSIL-Italic.ttf',
    'CharisSIL-BoldItalic.ttf',
  ])('public/fonts/%s exists and is non-empty', (name) => {
    const file = path.join(WEB_ROOT, 'public/fonts', name);
    expect(existsSync(file), file).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(0);
  });

  it('theme.css declares all 4 @font-face variants for CharisSIL', () => {
    const css = readFileSync(path.join(WEB_ROOT, 'src/theme/theme.css'), 'utf8');
    const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    const charisFaces = faces.filter((f) => f.includes("font-family: 'CharisSIL'"));
    expect(charisFaces.length).toBe(4);

    const combos = charisFaces.map((f) => ({
      weight: /font-weight:\s*(\d+)/.exec(f)?.[1],
      style: /font-style:\s*(\w+)/.exec(f)?.[1],
    }));
    expect(combos).toEqual(
      expect.arrayContaining([
        { weight: '400', style: 'normal' },
        { weight: '700', style: 'normal' },
        { weight: '400', style: 'italic' },
        { weight: '700', style: 'italic' },
      ]),
    );
  });
});
