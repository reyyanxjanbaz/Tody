# Tody — Web (PWA)

An installable, offline-capable Progressive Web App. This is the flagship (and now
only actively developed) client. The original React Native app is archived,
unmaintained, in [`legacy-native/`](./legacy-native) for reference — its logic layer
was the origin of `src/core/`, which now evolves independently.

## Stack

- **Vite 8** + **React 19** + **TypeScript**
- **vite-plugin-pwa** (Workbox) — manifest, service worker, offline, update prompt
- **React Router** (navigation) · **Framer Motion** (transitions/animation) ·
  **@use-gesture/react** (swipe / long-press) · **react-icons/io5** (Ionicons)

## Architecture

- `src/core/` — logic layer (contexts, lib, utils, types). Originally ported
  byte-for-byte from the native app; no longer required to stay in sync with it.
  A couple of RN-only modules are still neutralised by Vite path aliases → `src/shims/`:
  - `@react-native-async-storage/async-storage` → `shims/asyncStorage.ts` (localStorage)
  - `react-native-haptic-feedback` → `shims/haptics.ts` (Vibration API)
  - `react-native-url-polyfill/auto` → `shims/empty.ts`
- `src/theme/` — design tokens as CSS variables (`theme.css`) + Framer motion presets.
- `src/ui/` — design-system primitives (Button, Icon, Checkbox, Modal/Sheet, …).
- `src/components/` — feature components (TaskItem, TaskInput, CalendarStrip, …).
- `src/screens/` — the 9 screens.
- `src/app/` — providers, router (auth-gated + animated transitions), app shell.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
```

Supabase credentials live in `src/core/lib/env.ts` (anon key — safe to ship).

## Build & preview

```bash
npm run build    # tsc -b && vite build → dist/  (generates SW + manifest)
npm run preview  # serve the production build (service worker active)
```

## Deploy

Host-agnostic static output in `dist/`. SPA fallback is configured for both hosts:

- **Vercel** — Root Directory should be the repo root (`.`). If this project was
  previously linked with Root Directory `web`, update that setting in the Vercel
  dashboard after this reorg. `vercel.json` handles the SPA rewrite and cache headers.
  Build command `npm run build`, output `dist`.
- **Netlify** — base directory `.`, build `npm run build`, publish `dist`.
  `public/_redirects` handles the SPA fallback.

The service worker uses `registerType: 'prompt'` — users get a "new version available"
banner (`src/components/PWAUpdatePrompt.tsx`) instead of a silent swap.

## Notes

- A DEV-only offline auth bypass (`localStorage.__todyDevAuth`) exists for verifying
  authed screens without a live Supabase session. It is gated behind
  `import.meta.env.DEV` and is **stripped from production builds**.
