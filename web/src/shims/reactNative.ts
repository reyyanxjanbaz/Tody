/**
 * Minimal web shim for the bare 'react-native' package.
 *
 * Only exports what the ported logic layer actually references (Platform.OS
 * inside RN-only branches that never execute in the browser). Wired via a
 * Vite resolve.alias + a matching tsconfig path so both the bundler and the
 * type-checker resolve it, keeping the original ported files unchanged.
 */

export const Platform = {
  OS: 'web' as const,
  select: <T>(spec: { web?: T; default?: T; ios?: T; android?: T }): T | undefined =>
    spec.web ?? spec.default,
};
