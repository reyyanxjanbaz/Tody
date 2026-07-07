import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tsconfigPath = path.join(WEB_ROOT, 'tsconfig.app.json');
const src = existsSync(tsconfigPath) ? readFileSync(tsconfigPath, 'utf8') : '';

describe('Phase 0.6 — tsconfig.app.json path aliases', () => {
  it('exists', () => {
    expect(existsSync(tsconfigPath)).toBe(true);
  });

  it('maps @/* and @core/* into src', () => {
    expect(src).toMatch(/"@\/\*":\s*\["\.\/src\/\*"\]/);
    expect(src).toMatch(/"@core\/\*":\s*\["\.\/src\/core\/\*"\]/);
  });

  it('maps all 3 RN-only specifiers to the same shims as vite.config.ts', () => {
    expect(src).toMatch(/"@react-native-async-storage\/async-storage":\s*\["\.\/src\/shims\/asyncStorage\.ts"\]/);
    expect(src).toMatch(/"react-native-haptic-feedback":\s*\["\.\/src\/shims\/haptics\.ts"\]/);
    expect(src).toMatch(/"react-native-url-polyfill\/auto":\s*\["\.\/src\/shims\/empty\.ts"\]/);
  });

  it('includes the vite-plugin-pwa client/react ambient types', () => {
    expect(src).toMatch(/"types":\s*\[[^\]]*"vite-plugin-pwa\/client"[^\]]*\]/);
    expect(src).toMatch(/"types":\s*\[[^\]]*"vite-plugin-pwa\/react"[^\]]*\]/);
  });

  it('keeps strict mode on for freshly authored code', () => {
    expect(src).toMatch(/"strict":\s*true/);
  });
});
