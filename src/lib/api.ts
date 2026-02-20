/**
 * Tody API Client
 *
 * Central HTTP client for all requests to the Render backend at
 * https://tody-backend.onrender.com.
 *
 * Responsibilities:
 *   • Retrieves the Supabase session JWT and attaches it as an
 *     `Authorization: Bearer <token>` header on every request.
 *   • Normalises responses into { data, error, isBackendDown }.
 *   • Times out after 12 s (Render free-tier cold starts can take ~10 s).
 *
 * Error strategy for callers:
 *   • isBackendDown = true  → network failure / timeout → fall back to a
 *     direct Supabase operation so the user is never left in a broken state.
 *   • isBackendDown = false, error ≠ null → logical error (404, 422, etc.)
 *     → log and surface; do NOT silently retry via Supabase.
 *   • error = null → success.
 */

import { supabase } from './supabase';

export const RENDER_BASE_URL = 'https://tody-backend.onrender.com';

/** Render free-tier cold-start tolerance */
const API_TIMEOUT_MS = 12_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  status?: number;
}

export interface ApiResult<T = unknown> {
  data: T | null;
  error: ApiError | null;
  /**
   * `true` when the request could not reach the server (network error,
   * timeout, DNS failure, etc.).  Callers should fall back to a direct
   * Supabase operation.
   */
  isBackendDown: boolean;
}

// ── Token retrieval ───────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ── Core request ──────────────────────────────────────────────────────────────

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const token = await getAccessToken();

  if (!token) {
    return {
      data: null,
      error: { message: 'Not authenticated — no active Supabase session' },
      isBackendDown: false,
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${RENDER_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    // 204 No Content – success with no response body
    if (response.status === 204) {
      return { data: null, error: null, isBackendDown: false };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok) {
      const detail =
        (json as any)?.detail ??
        (json as any)?.message ??
        `HTTP ${response.status}`;
      return {
        data: null,
        error: { message: String(detail), status: response.status },
        isBackendDown: false,
      };
    }

    return { data: json as T, error: null, isBackendDown: false };
  } catch (err: unknown) {
    clearTimeout(timeoutHandle);

    const msg =
      err instanceof Error ? err.message : String(err ?? 'Unknown error');

    // AbortError = our own timeout; TypeError with "network/fetch/failed/load"
    // = connectivity issue → treat both as backend-down
    const isDown =
      (err as any)?.name === 'AbortError' ||
      /abort|network|fetch|failed|load|timeout/i.test(msg);

    return { data: null, error: { message: msg }, isBackendDown: isDown };
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

export const api = {
  get: <T = unknown>(path: string): Promise<ApiResult<T>> =>
    apiRequest<T>('GET', path),

  post: <T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>> =>
    apiRequest<T>('POST', path, body),

  patch: <T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> =>
    apiRequest<T>('PATCH', path, body),

  delete: <T = unknown>(path: string): Promise<ApiResult<T>> =>
    apiRequest<T>('DELETE', path),
};
