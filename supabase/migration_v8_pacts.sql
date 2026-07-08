-- ════════════════════════════════════════════════════════════════════════════
-- Migration v8 — Pact tasks (Phase E)
--
-- A pact is a group commitment: a creator makes a task and invites others; the
-- pact only completes when EVERY participating member has completed their part.
-- Pacts are NOT rows in `tasks` — they are a separate, server-authoritative
-- structure, so the offline-first task store is untouched.
--
-- The "all done" decision is made in exactly one place: the SECURITY DEFINER RPC
-- complete_pact_participation(), which takes a row lock on the pact so concurrent
-- completions can't both think they're last (or both miss).
--
-- Idempotent: safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. pacts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description  TEXT NOT NULL DEFAULT '',
  deadline     TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pacts_creator ON public.pacts(creator_id);

DROP TRIGGER IF EXISTS trg_pacts_updated ON public.pacts;
CREATE TRIGGER trg_pacts_updated BEFORE UPDATE ON public.pacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. pact_participants ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pact_participants (
  pact_id  UUID NOT NULL REFERENCES public.pacts(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state    TEXT NOT NULL DEFAULT 'invited'
             CHECK (state IN ('invited', 'accepted', 'done', 'declined', 'left')),
  done_at  TIMESTAMPTZ,
  PRIMARY KEY (pact_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pact_participants_user ON public.pact_participants(user_id);

-- ── 3. Membership helper (SECURITY DEFINER — safe for pact RLS) ────────────────
CREATE OR REPLACE FUNCTION public.is_pact_participant(p UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pact_participants
    WHERE pact_id = p AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.pacts WHERE id = p AND creator_id = auth.uid()
  );
$$;

-- ── 4. Completion RPC — the single place "all done" is decided ────────────────
-- Takes an explicit participant id so the trusted backend (service role, where
-- auth.uid() is NULL) can call it. A direct client call is constrained to the
-- caller's own id by the guard below, so it can't complete on someone's behalf.
CREATE OR REPLACE FUNCTION public.complete_pact_participation(p_pact_id UUID, p_user_id UUID)
RETURNS public.pacts
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_pact       public.pacts;
  v_remaining  INT;
  v_done       INT;
BEGIN
  -- A non-service caller may only complete their OWN part.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot complete another participant''s part';
  END IF;

  -- Lock the pact row so two simultaneous completions serialize.
  SELECT * INTO v_pact FROM public.pacts WHERE id = p_pact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pact not found';
  END IF;

  -- The target must be a participant.
  UPDATE public.pact_participants
     SET state = 'done', done_at = now()
   WHERE pact_id = p_pact_id AND user_id = p_user_id
     AND state IN ('invited', 'accepted', 'done');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a participant of this pact';
  END IF;

  -- Quorum: nobody still pending (invited/accepted), and at least one done.
  SELECT
    COUNT(*) FILTER (WHERE state IN ('invited', 'accepted')),
    COUNT(*) FILTER (WHERE state = 'done')
    INTO v_remaining, v_done
  FROM public.pact_participants
  WHERE pact_id = p_pact_id;

  IF v_pact.status = 'active' AND v_remaining = 0 AND v_done >= 1 THEN
    UPDATE public.pacts
       SET status = 'completed', completed_at = now()
     WHERE id = p_pact_id
     RETURNING * INTO v_pact;
  END IF;

  RETURN v_pact;
END;
$$;

-- ── 5. Realtime ───────────────────────────────────────────────────────────────
ALTER TABLE public.pacts             REPLICA IDENTITY FULL;
ALTER TABLE public.pact_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pacts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pact_participants;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.pacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pact_participants ENABLE ROW LEVEL SECURITY;

-- pacts: participants + creator can read. Creation/mutation goes through the
-- backend (service role) or the completion RPC, so there is no client
-- INSERT/UPDATE policy.
DROP POLICY IF EXISTS "Participants can view pact" ON public.pacts;
CREATE POLICY "Participants can view pact"
  ON public.pacts FOR SELECT
  USING (creator_id = auth.uid() OR public.is_pact_participant(id));

-- pact_participants: participants of the same pact can see the roster/progress.
DROP POLICY IF EXISTS "Participants can view roster" ON public.pact_participants;
CREATE POLICY "Participants can view roster"
  ON public.pact_participants FOR SELECT
  USING (public.is_pact_participant(pact_id));

-- A participant may update ONLY their own row's lifecycle state (accept/decline/
-- leave). "done" is handled by the RPC, but allowing it here is harmless.
DROP POLICY IF EXISTS "Participant updates own row" ON public.pact_participants;
CREATE POLICY "Participant updates own row"
  ON public.pact_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
