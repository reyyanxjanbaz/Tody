/// <reference types="vite/client" />

/**
 * React Native's global dev flag, referenced verbatim in ported logging code
 * (e.g. core/lib/supabaseSync.ts). Replaced at build time by Vite's `define`
 * (see vite.config.ts) with `import.meta.env.DEV`; declared here so tsc's
 * type-checker also accepts the bare identifier.
 */
declare const __DEV__: boolean;
