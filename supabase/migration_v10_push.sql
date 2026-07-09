-- ════════════════════════════════════════════════════════════════════════════
-- Migration v10 — Web Push notifications
--
-- Stores per-device push subscriptions and per-category notification prefs so
-- the FastAPI backend (service role) can deliver server-initiated Web Push
-- (assignment / pact / friend events) even when the PWA is closed.
--
-- Idempotent: safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. push_subscriptions (one row per browser/device endpoint) ───────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint   TEXT PRIMARY KEY,                                   -- unique per device+browser
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  p256dh     TEXT NOT NULL,                                      -- client public key
  auth       TEXT NOT NULL,                                      -- client auth secret
  ua         TEXT,                                               -- user-agent (debug/display)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- ── 2. Per-category notification prefs (default: all on) ──────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_prefs JSONB NOT NULL
  DEFAULT '{"assignment":true,"pact":true,"friend":true,"leaderboard":true,"reminders":true}'::jsonb;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner may manage their own subscriptions. The backend also writes/reads these
-- via the service role (which bypasses RLS) when subscribing and sending.
DROP POLICY IF EXISTS "Owner manages own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Owner manages own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
