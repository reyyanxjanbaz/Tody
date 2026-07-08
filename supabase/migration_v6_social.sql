-- ════════════════════════════════════════════════════════════════════════════
-- Migration v6 — Social competition (Phase C)
--
-- Friends, shareable invite codes, and an opt-in stat-sharing flag. Leaderboards
-- are computed server-side (FastAPI, service role) — there is deliberately NO
-- client-readable leaderboard view, so task RLS never has to open up to friends
-- and weekly XP can be anti-cheated in one place.
--
-- The `invites` table is the single invite machine reused by Phases D (workspace
-- invites) and E (pact invites) via the `kind` + `target_id` columns.
--
-- Idempotent: safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. friendships (undirected, one row per pair) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  user_a     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)  -- canonical ordering → exactly one row per pair
);

CREATE INDEX IF NOT EXISTS idx_friendships_a ON public.friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON public.friendships(user_b);

-- ── 2. invites (shareable codes; reused by Phases D/E) ────────────────────────
CREATE TABLE IF NOT EXISTS public.invites (
  code       TEXT PRIMARY KEY,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'friend' CHECK (kind IN ('friend', 'workspace', 'pact')),
  target_id  UUID,  -- workspace_id / pact_id for kinds beyond 'friend'
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  max_uses   INT NOT NULL DEFAULT 10 CHECK (max_uses > 0),
  use_count  INT NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_inviter ON public.invites(inviter_id);

-- ── 3. Privacy: opt-in stat sharing ───────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_stats BOOLEAN NOT NULL DEFAULT false;

-- ── 4. Friendship helper (SECURITY DEFINER — safe for profile RLS) ────────────
CREATE OR REPLACE FUNCTION public.are_friends(other UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user_a = auth.uid() AND user_b = other)
       OR (user_b = auth.uid() AND user_a = other)
  );
$$;

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites     ENABLE ROW LEVEL SECURITY;

-- friendships: either party may read or delete (unfriend). INSERT is server-only
-- (service role, via invite redemption) so friendships can't be forged from the
-- client — there is intentionally no INSERT policy.
DROP POLICY IF EXISTS "Friends can view friendship" ON public.friendships;
CREATE POLICY "Friends can view friendship"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Either party can unfriend" ON public.friendships;
CREATE POLICY "Either party can unfriend"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- invites: inviter can read/manage their own codes. Redemption (SELECT-by-code
-- for a non-owner + use_count bump + friendship insert) happens through the
-- backend with the service role, so no cross-user client policy is needed.
DROP POLICY IF EXISTS "Inviter manages own invites" ON public.invites;
CREATE POLICY "Inviter manages own invites"
  ON public.invites FOR ALL
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);

-- profiles: allow reading a friend's public card (name/avatar). The client query
-- must select only non-sensitive columns; this policy just permits the row.
DROP POLICY IF EXISTS "Friends can view basic profile" ON public.profiles;
CREATE POLICY "Friends can view basic profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.are_friends(id));
