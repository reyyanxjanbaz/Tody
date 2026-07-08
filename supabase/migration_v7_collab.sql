-- ════════════════════════════════════════════════════════════════════════════
-- Migration v7 — Collaboration + task assignment (Phase D)
--
-- Turns a shared workspace into a live collaboration surface: members see each
-- other's tasks in real time (Supabase Realtime) and can assign tasks to one
-- another. The workspace membership + RLS scaffolding already exists from v5;
-- this migration adds the assignee column, turns on Realtime for tasks, and
-- hardens the member UPDATE policy so a task can't be smuggled out of a shared
-- workspace.
--
-- Idempotent: safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Task assignee ──────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id) WHERE assignee_id IS NOT NULL;

-- ── 2. Realtime on tasks ──────────────────────────────────────────────────────
-- REPLICA IDENTITY FULL is required so UPDATE/DELETE change payloads include the
-- full OLD row (needed for RLS-filtered postgres_changes and for the client to
-- know which workspace a deleted row belonged to).
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

-- Add tasks to the realtime publication (guarded — ADD TABLE errors if present).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already in the publication
  WHEN undefined_object THEN NULL;   -- publication missing (non-Supabase dev DB)
END $$;

-- Categories in a shared workspace must be visible to all members so shared
-- tasks can resolve their category. Same for live category edits.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE public.categories REPLICA IDENTITY FULL;

-- ── 3. Harden the shared-task UPDATE policy ───────────────────────────────────
-- v5 allowed members to UPDATE tasks in their workspace. Re-assert it with a
-- WITH CHECK that keeps the row inside a workspace the writer belongs to (or
-- their own personal space) — a member can't move a task into a workspace they
-- aren't part of, or hijack someone else's personal task.
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  );

-- ── 4. Assignee must be a member of the task's workspace ──────────────────────
-- Enforced primarily by the backend /tasks/{id}/assign endpoint; this trigger is
-- a defense-in-depth guard for direct Supabase writes (offline fallback path).
CREATE OR REPLACE FUNCTION public.validate_task_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    -- Personal tasks may only be assigned to their owner.
    IF NEW.workspace_id IS NULL THEN
      IF NEW.assignee_id <> NEW.user_id THEN
        RAISE EXCEPTION 'Cannot assign a personal task to another user';
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = NEW.workspace_id AND user_id = NEW.assignee_id
      ) THEN
        RAISE EXCEPTION 'Assignee is not a member of the workspace';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_assignee ON public.tasks;
CREATE TRIGGER trg_validate_task_assignee
  BEFORE INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_assignee();
