-- Migration v3 — soft-delete tombstones for cross-device deletion propagation.
--
-- Without this, a task/category/inbox row deleted on device A is re-inserted by
-- device B's "push all local" sync step (device B never learned about the
-- delete), resurrecting it everywhere. A `deleted_at` tombstone column lets the
-- incremental sync feed carry the deletion to every device.
--
-- Idempotent: safe to run multiple times. Apply BEFORE relying on the server
-- soft-delete endpoints; the web client is schema-agnostic and works with or
-- without these columns.

ALTER TABLE public.tasks       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.categories  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.inbox_tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial indexes so the common "live rows only" queries stay fast.
CREATE INDEX IF NOT EXISTS idx_tasks_live
  ON public.tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_live
  ON public.categories(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_live
  ON public.inbox_tasks(user_id) WHERE deleted_at IS NULL;

-- Optional housekeeping (run manually or via pg_cron): permanently purge rows
-- tombstoned more than 30 days ago — by then every device has synced the delete.
--   DELETE FROM public.tasks       WHERE deleted_at < now() - interval '30 days';
--   DELETE FROM public.categories  WHERE deleted_at < now() - interval '30 days';
--   DELETE FROM public.inbox_tasks WHERE deleted_at < now() - interval '30 days';
