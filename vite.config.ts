import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      '@core': r('./src/core'),
      // Native-only modules → web shims (keeps the ported logic layer unchanged)
      '@react-native-async-storage/async-storage': r('./src/shims/asyncStorage.ts'),
      'react-native-haptic-feedback': r('./src/shims/haptics.ts'),
      'react-native-url-polyfill/auto': r('./src/shims/empty.ts'),
      'react-native': r('./src/shims/reactNative.ts'),
    },
  },
  define: {
    // RN's global dev flag, referenced verbatim in ported logging code.
    __DEV__: 'import.meta.env.DEV',
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('framer-motion') || id.includes('@use-gesture')) return 'vendor-motion'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('react-icons')) return 'vendor-icons'
          return 'vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'fonts/*.ttf'],
      manifest: {
        name: 'ToDy — human-centric to-dos',
        short_name: 'ToDy',
        description:
          'The human-centric to-do list that respects your psychology.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ttf,woff2,png,svg,ico}'],
        navigateFallback: '/index.html',
        // P6.1 — fold our notificationclick handler into the generated SW
        // (stays on generateSW; no switch to injectManifest).
        importScripts: ['sw-notifications.js'],
        runtimeCaching: [
          {
            // Supabase REST/Auth + FastAPI backend — network-first, brief cache
            urlPattern:
              /^https:\/\/(zforpxbowpiotzmoqeif\.supabase\.co|tody-backend\.onrender\.com)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tody-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
