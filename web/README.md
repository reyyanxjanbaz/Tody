# ToDy — Web (PWA)

An installable, offline-capable Progressive Web App port of the Tody React Native
app. Same Supabase project and FastAPI backend; the UI is rebuilt for the DOM while
the **entire logic layer is reused** from the native app.

## Stack

- **Vite 8** + **React 19** + **TypeScript**
- **vite-plugin-pwa** (Workbox) — manifest, service worker, offline, update prompt
- **React Router** (navigation) · **Framer Motion** (transitions/animation) ·
  **@use-gesture/react** (swipe / long-press) · **react-icons/io5** (Ionicons)

## Architecture

- `src/core/` — logic layer copied from the native `src/` (contexts, lib, utils, types).
  RN-only modules are neutralised by Vite path aliases → `src/shims/`:
  - `@react-native-async-storage/async-storage` → `shims/asyncStorage.ts` (localStorage)
  - `react-native-haptic-feedback` → `shims/haptics.ts` (Vibration API)
  - `react-native-url-polyfill/auto` → `shims/empty.ts`
- `src/theme/` — design tokens as CSS variables (`theme.css`) + Framer motion presets.
- `src/ui/` — design-system primitives (Button, Icon, Checkbox, Modal/Sheet, …).
- `src/components/` — ported feature components (TaskItem, TaskInput, CalendarStrip, …).
- `src/screens/` — the 9 screens.
- `src/app/` — providers, router (auth-gated + animated transitions), app shell.

## Develop

```bash
cd web
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

- **Vercel** — set **Root Directory = `web`**. `vercel.json` handles the SPA rewrite
  and cache headers. Build command `npm run build`, output `dist`.
- **Netlify** — base directory `web`, build `npm run build`, publish `web/dist`.
  `public/_redirects` handles the SPA fallback.

The service worker uses `registerType: 'prompt'` — users get a "new version available"
banner (`src/components/PWAUpdatePrompt.tsx`) instead of a silent swap.

## Notes

- A DEV-only offline auth bypass (`localStorage.__todyDevAuth`) exists for verifying
  authed screens without a live Supabase session. It is gated behind
  `import.meta.env.DEV` and is **stripped from production builds**.
