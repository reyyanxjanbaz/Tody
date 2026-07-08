-- ════════════════════════════════════════════════════════════════════════════
-- Migration v5 — Workspaces (Phase B)
--
-- User-defined workspaces (e.g. Office / Home / Quick Jots) that group tasks,
-- categories, habits and inbox captures. Switching workspace refocuses the whole
-- app to that workspace's content.
--
-- Design:
--   • `workspaces` + `workspace_members` are created from day one. Until Phase D
--     (collaboration) the only member of any workspace is its owner.
--   • `workspace_id` is added NULLABLE to tasks/categories/habits/inbox_tasks.
--     NULL means the implicit "Personal" workspace. There is NO backfill — every
--     existing row stays NULL and the client maps NULL → Personal. This keeps the
--     migration zero-risk and the offline model unchanged for existing data.
--   • `is_workspace_member(ws)` is a SECURITY DEFINER helper so RLS policies never
--     recurse through workspace_members. The tasks/categories/habits policies are
--     extended now (harmless while owner-only) so Phase D needs no policy churn.
--
-- Idempotent: safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. workspaces ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  icon       TEXT NOT NULL DEFAULT 'albums-outline',
  accent     TEXT CHECK (accent IS NULL OR accent ~ '^#[0-9a-fA-F]{6}$'),
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ  -- soft-delete tombstone (cross-device)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_live  ON public.workspaces(owner_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_workspaces_updated ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. workspace_members ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- Auto-insert the owner as a member whenever a workspace is created.
CREATE OR REPLACE FUNCTION public.add_workspace_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_owner_member ON public.workspaces;
CREATE TRIGGER trg_workspace_owner_member
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_member();

-- ── 3. Membership helper (SECURITY DEFINER — breaks RLS recursion) ────────────
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws AND user_id = auth.uid()
  );
$$;

-- ── 4. workspace_id columns (NULL = Personal; no backfill) ────────────────────
ALTER TABLE public.tasks       ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.categories  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.habits      ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.inbox_tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_workspace      ON public.tasks(workspace_id)       WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON public.categories(workspace_id)  WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_habits_workspace     ON public.habits(workspace_id)      WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_workspace      ON public.inbox_tasks(workspace_id) WHERE workspace_id IS NOT NULL;

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- workspaces: a user sees a workspace they own or are a member of.
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = owner_id OR public.is_workspace_member(id));

DROP POLICY IF EXISTS "Users can insert own workspaces" ON public.workspaces;
CREATE POLICY "Users can insert own workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update workspaces" ON public.workspaces;
CREATE POLICY "Owners can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- workspace_members: a member can view the roster of workspaces they belong to.
-- INSERT/DELETE are owner-only in Phase B (Phase D adds invite-based joins via
-- the service role). A member can always remove themselves (leave).
DROP POLICY IF EXISTS "Members can view roster" ON public.workspace_members;
CREATE POLICY "Members can view roster"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Owners can add members" ON public.workspace_members;
CREATE POLICY "Owners can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners remove members or self leaves" ON public.workspace_members;
CREATE POLICY "Owners remove members or self leaves"
  ON public.workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.workspaces w
               WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

-- ── 6. Extend existing table policies to cover shared workspaces ──────────────
-- Harmless today (owner is the only member) and ready for Phase D. We replace the
-- "own row" policies with "own row OR member of the row's workspace".

-- tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id
              OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)))
  WITH CHECK (auth.uid() = user_id
              OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

-- categories
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id
              OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)))
  WITH CHECK (auth.uid() = user_id
              OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

-- habits (single FOR ALL policy in the base schema)
DROP POLICY IF EXISTS "Users manage own habits" ON public.habits;
CREATE POLICY "Users manage own habits"
  ON public.habits FOR ALL
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)))
  WITH CHECK (auth.uid() = user_id
              OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

-- inbox_tasks
DROP POLICY IF EXISTS "Users can view own inbox" ON public.inbox_tasks;
CREATE POLICY "Users can view own inbox"
  ON public.inbox_tasks FOR SELECT
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can insert into own inbox" ON public.inbox_tasks;
CREATE POLICY "Users can insert into own inbox"
  ON public.inbox_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id
              OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can update own inbox tasks" ON public.inbox_tasks;
CREATE POLICY "Users can update own inbox tasks"
  ON public.inbox_tasks FOR UPDATE
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)))
  WITH CHECK (auth.uid() = user_id
              OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "Users can delete own inbox tasks" ON public.inbox_tasks;
CREATE POLICY "Users can delete own inbox tasks"
  ON public.inbox_tasks FOR DELETE
  USING (auth.uid() = user_id
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));
