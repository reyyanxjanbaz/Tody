import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Standalone test config (mirrors vite.config.ts's resolve.alias) — deliberately
// does NOT include the VitePWA plugin, which hooks into the production build
// pipeline and has no place in a jsdom test environment.
export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      '@core': r('./src/core'),
      '@react-native-async-storage/async-storage': r('./src/shims/asyncStorage.ts'),
      'react-native-haptic-feedback': r('./src/shims/haptics.ts'),
      'react-native-url-polyfill/auto': r('./src/shims/empty.ts'),
      // vite-plugin-pwa's virtual module — only exists when the VitePWA
      // plugin runs (excluded here), so alias it to any resolvable file;
      // pwaUpdatePrompt.test.tsx replaces its exports via vi.mock() by id.
      'virtual:pwa-register/react': r('./src/shims/empty.ts'),
    },
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
    include: [
      'tests/phase0/**/*.test.ts',
      'tests/phase1/**/*.test.{ts,tsx}',
      'tests/phase2/**/*.test.{ts,tsx}',
      'tests/phase4/**/*.artifacts.test.ts',
      'tests/phase4/**/*.test.tsx',
      'tests/phase5-habits/**/*.test.{ts,tsx}',
      'tests/phaseA/**/*.test.{ts,tsx}',
      'tests/phaseB/**/*.test.{ts,tsx}',
      'tests/phaseC/**/*.test.{ts,tsx}',
      'tests/phaseD/**/*.test.{ts,tsx}',
      'tests/phaseE/**/*.test.{ts,tsx}',
      'tests/phaseF/**/*.test.{ts,tsx}',
    ],
  },
})
