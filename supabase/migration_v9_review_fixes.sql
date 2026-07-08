-- ════════════════════════════════════════════════════════════════════════════
-- Migration v9 — Code-review remediation (Phase A–E hardening)
--
-- H1 (security): the v6 "Friends can view basic profile" policy granted friends
-- row-level SELECT on public.profiles — which is ALL columns, including email and
-- settings JSON. RLS can't restrict columns, and no client code reads profiles
-- directly for friend data (friends/leaderboard/members all come through the
-- backend service role, which returns only display_name/avatar_url). So the
-- policy is unnecessary and leaky — drop it. The base "Users can view own
-- profile" policy is retained, so own-profile reads keep working.
--
-- Idempotent: safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Friends can view basic profile" ON public.profiles;

-- are_friends() is now only referenced conceptually / by the backend; it is a
-- harmless SECURITY DEFINER helper, so we leave it in place for future use.
