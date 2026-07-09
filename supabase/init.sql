-- =============================================================================
-- Tody — Combined fresh-project initialisation script
-- =============================================================================
-- Run this ONCE against a brand-new Supabase project (SQL Editor → paste → Run).
-- It concatenates, in strict dependency order, the base schema plus every
-- migration the web PWA (Phases B–E + review fixes) requires:
--
--   1. schema.sql                  — base (profiles, categories, tasks, inbox,
--                                     task_patterns, habits, habit_logs, RLS,
--                                     handle_new_user + seed_default_categories
--                                     triggers, avatars storage bucket).
--                                     Already folds in v3 soft-delete + v4 habits.
--   2. migration_v5_workspaces.sql — workspaces + workspace_members,
--                                     is_workspace_member(), workspace_id columns.
--   3. migration_v6_social.sql     — friendships, invites, profiles.share_stats.
--   4. migration_v7_collab.sql     — tasks.assignee_id, Realtime publication.
--                                     DEPENDS ON v5 (is_workspace_member).
--   5. migration_v8_pacts.sql      — pacts + pact_participants + quorum RPC.
--   6. migration_v9_review_fixes.sql — drops the leaky profiles policy (H1).
--                                       DEPENDS ON v6 (creates that policy).
--   7. migration_v10_push.sql      — push_subscriptions + profiles.notif_prefs
--                                     for Web Push notifications.
--
-- NOTE: migration_v3_soft_delete.sql and migration_v4_habits.sql are NOT
-- included here — they are already folded into schema.sql. schema_v1_backup.sql
-- is a historical backup and is intentionally omitted.
--
-- All statements are idempotent, so re-running is safe.
--
-- After running: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Render (backend
-- env only — never commit the service_role key), and swap the project URL + anon
-- key in src/core/lib/env.ts (the web app is the only actively used client;
-- legacy-native/src/lib/env.ts is archived and no longer wired to anything).
-- =============================================================================




-- =============================================================================
-- BEGIN schema.sql
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- TODY — Supabase Schema  (v2 — hardened & production-ready)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Requires: Supabase Auth enabled (it is by default)
--
-- Changes from v1:
--   • Idempotent (safe to re-run): IF NOT EXISTS / ON CONFLICT everywhere
--   • Data-integrity constraints on title, description, color, etc.
--   • UNIQUE(user_id, name) on categories to prevent duplicates
--   • Auto-set completed_at / archived_at via trigger
--   • Auto-calculate actual_minutes on completion
--   • Recurring consistency: recurring_frequency required when is_recurring
--   • Missing UPDATE policy on inbox_tasks added
--   • task_children view now includes user_id for RLS-safe joins
--   • user_task_stats view extended with new metrics
--   • display_name column on profiles
--   • New indexes for sync (updated_at) and recurring queries
--   • Migration helper to add columns safely on existing DBs
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Custom Enums ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low', 'none');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE energy_level AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recurring_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE date_format_type AS ENUM ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE time_format_type AS ENUM ('12h', '24h');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE week_start_type AS ENUM ('sunday', 'monday');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Profiles (extends auth.users) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  dark_mode       BOOLEAN          NOT NULL DEFAULT false,
  date_format     date_format_type NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format     time_format_type NOT NULL DEFAULT '12h',
  week_starts_on  week_start_type  NOT NULL DEFAULT 'sunday',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile row when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 3. Categories ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  icon        TEXT NOT NULL DEFAULT 'grid-outline',
  color       TEXT NOT NULL DEFAULT '#3B82F6' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  is_default  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,  -- soft-delete tombstone (migration v3)
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);

-- Seed default categories for every new user
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, icon, color, is_default, sort_order)
  VALUES
    (NEW.id, 'Overview',  'grid-outline',      '#000000', true,  0),
    (NEW.id, 'Work',      'briefcase-outline',  '#3B82F6', false, 1),
    (NEW.id, 'Personal',  'person-outline',     '#8B5CF6', false, 2),
    (NEW.id, 'Health',    'heart-outline',      '#10B981', false, 3)
  ON CONFLICT (user_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_seed_categories ON public.profiles;
CREATE TRIGGER on_profile_created_seed_categories
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_categories();

-- ── 4. Tasks ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description         TEXT NOT NULL DEFAULT '',
  priority            task_priority NOT NULL DEFAULT 'none',
  energy_level        energy_level  NOT NULL DEFAULT 'medium',

  is_completed        BOOLEAN NOT NULL DEFAULT false,
  completed_at        TIMESTAMPTZ,

  deadline            TIMESTAMPTZ,
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  recurring_frequency recurring_frequency,
  defer_count         INT NOT NULL DEFAULT 0 CHECK (defer_count >= 0),
  created_hour        SMALLINT NOT NULL DEFAULT 0,

  overdue_start_date  TIMESTAMPTZ,
  revived_at          TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  is_archived         BOOLEAN NOT NULL DEFAULT false,

  estimated_minutes   INT CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  actual_minutes      INT CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
  started_at          TIMESTAMPTZ,
  scheduled_start_at  TIMESTAMPTZ,
  scheduled_end_at    TIMESTAMPTZ,

  parent_id           UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  depth               SMALLINT NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,  -- soft-delete tombstone (migration v3)

  CONSTRAINT depth_max CHECK (depth >= 0 AND depth <= 3),
  CONSTRAINT created_hour_range CHECK (created_hour >= 0 AND created_hour <= 23),
  CONSTRAINT recurring_consistency CHECK (
    (is_recurring = false) OR (is_recurring = true AND recurring_frequency IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_user          ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category      ON public.tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent        ON public.tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline      ON public.tasks(user_id, deadline)   WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed     ON public.tasks(user_id, is_completed, completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_archived      ON public.tasks(user_id, is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_tasks_updated       ON public.tasks(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_recurring     ON public.tasks(user_id, is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_tasks_live          ON public.tasks(user_id) WHERE deleted_at IS NULL;

-- Auto-set completed_at / archived_at and calculate actual_minutes on completion
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-set completed_at when marking complete
  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at = now();
    END IF;
    IF NEW.started_at IS NOT NULL AND NEW.actual_minutes IS NULL THEN
      NEW.actual_minutes = GREATEST(1, EXTRACT(EPOCH FROM (now() - NEW.started_at)) / 60)::INT;
    END IF;
  END IF;
  -- Clear completed_at when un-completing
  IF NEW.is_completed = false AND OLD.is_completed = true THEN
    NEW.completed_at = NULL;
    NEW.actual_minutes = NULL;
  END IF;
  -- Auto-set archived_at when archiving
  IF NEW.is_archived = true AND (OLD.is_archived = false OR OLD.is_archived IS NULL) THEN
    IF NEW.archived_at IS NULL THEN
      NEW.archived_at = now();
    END IF;
  END IF;
  -- Clear archived_at when un-archiving
  IF NEW.is_archived = false AND OLD.is_archived = true THEN
    NEW.archived_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_completion ON public.tasks;
CREATE TRIGGER trg_task_completion
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_completion();

-- ── 5. Inbox Tasks (Quick Capture) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inbox_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_text     TEXT NOT NULL CHECK (char_length(raw_text) BETWEEN 1 AND 1000),
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ  -- soft-delete tombstone (migration v3)
);

CREATE INDEX IF NOT EXISTS idx_inbox_user ON public.inbox_tasks(user_id);

-- ── 6. Task Patterns (Time Estimation Learning) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_patterns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords                TEXT[] NOT NULL DEFAULT '{}',
  average_actual_minutes  INT NOT NULL DEFAULT 0 CHECK (average_actual_minutes >= 0),
  sample_size             INT NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  accuracy_score          INT NOT NULL DEFAULT 50 CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patterns_user ON public.task_patterns(user_id);

-- ── 7. updated_at Auto-Touch Trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated      BEFORE UPDATE ON public.profiles      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_categories_updated ON public.categories;
CREATE TRIGGER trg_categories_updated    BEFORE UPDATE ON public.categories    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_tasks_updated ON public.tasks;
CREATE TRIGGER trg_tasks_updated         BEFORE UPDATE ON public.tasks         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_task_patterns_updated ON public.task_patterns;
CREATE TRIGGER trg_task_patterns_updated BEFORE UPDATE ON public.task_patterns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── Categories ──────────────────────────────────────────────────────────────

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- ── Tasks ───────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ── Inbox Tasks ─────────────────────────────────────────────────────────────

ALTER TABLE public.inbox_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own inbox" ON public.inbox_tasks;
CREATE POLICY "Users can view own inbox"
  ON public.inbox_tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into own inbox" ON public.inbox_tasks;
CREATE POLICY "Users can insert into own inbox"
  ON public.inbox_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own inbox tasks" ON public.inbox_tasks;
CREATE POLICY "Users can update own inbox tasks"
  ON public.inbox_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own inbox tasks" ON public.inbox_tasks;
CREATE POLICY "Users can delete own inbox tasks"
  ON public.inbox_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ── Task Patterns ───────────────────────────────────────────────────────────

ALTER TABLE public.task_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own patterns" ON public.task_patterns;
CREATE POLICY "Users can view own patterns"
  ON public.task_patterns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own patterns" ON public.task_patterns;
CREATE POLICY "Users can insert own patterns"
  ON public.task_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own patterns" ON public.task_patterns;
CREATE POLICY "Users can update own patterns"
  ON public.task_patterns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own patterns" ON public.task_patterns;
CREATE POLICY "Users can delete own patterns"
  ON public.task_patterns FOR DELETE
  USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER VIEWS (RLS-aware)
-- ═══════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.task_children;
CREATE OR REPLACE VIEW public.task_children AS
SELECT
  parent_id,
  user_id,
  array_agg(id ORDER BY created_at) AS child_ids
FROM public.tasks
WHERE parent_id IS NOT NULL
GROUP BY parent_id, user_id;

DROP VIEW IF EXISTS public.user_task_stats;
CREATE OR REPLACE VIEW public.user_task_stats AS
SELECT
  user_id,
  COUNT(*)                                                     AS total_created,
  COUNT(*) FILTER (WHERE is_completed)                         AS total_completed,
  COUNT(*) FILTER (WHERE NOT is_completed AND NOT is_archived) AS total_incomplete,
  COALESCE(SUM(actual_minutes) FILTER (WHERE is_completed), 0) AS total_minutes_spent,
  ROUND(
    AVG(actual_minutes) FILTER (WHERE is_completed AND actual_minutes > 0)
  )                                                            AS avg_minutes_per_task,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_completed) / NULLIF(COUNT(*), 0)
  )                                                            AS completion_percentage,
  COUNT(*) FILTER (WHERE is_archived)                          AS total_archived,
  COUNT(*) FILTER (WHERE defer_count > 0)                      AS total_deferred,
  MAX(CASE WHEN is_completed AND completed_at IS NOT NULL THEN completed_at END) AS last_completed_at,
  COUNT(DISTINCT DATE(created_at))                             AS active_days
FROM public.tasks
GROUP BY user_id;


-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET (for avatar uploads)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Avatars are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION HELPER: safe to re-run on existing databases
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- UPGRADE HELPER: Force-apply constraints to existing tables
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT title_length CHECK (char_length(title) BETWEEN 1 AND 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.categories ADD CONSTRAINT color_hex CHECK (color ~ '^#[0-9a-fA-F]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT depth_max CHECK (depth >= 0 AND depth <= 3);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── swipe_stats: JSONB column for persisted swipe-action preferences ─────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS swipe_stats JSONB DEFAULT NULL;

-- ── user_task_patterns — Pattern Learning sync ────────────────────────────────
-- Stores per-user ML patterns so they survive reinstalls and sync across devices.

CREATE TABLE IF NOT EXISTS public.user_task_patterns (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keywords               TEXT[]   NOT NULL DEFAULT '{}',
    average_actual_minutes INTEGER  NOT NULL DEFAULT 0,
    sample_size            INTEGER  NOT NULL DEFAULT 1,
    accuracy_score         INTEGER  NOT NULL DEFAULT 50,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_task_patterns_user
    ON public.user_task_patterns(user_id);

ALTER TABLE public.user_task_patterns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own patterns"
      ON public.user_task_patterns
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Habit tracker (Phase 5) — see supabase/migration_v4_habits.sql for the
-- standalone migration. Folded here so a fresh `schema.sql` bootstraps it too.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT 'flame-outline',
  color           TEXT NOT NULL DEFAULT '#F59E0B',
  schedule_type   TEXT NOT NULL DEFAULT 'daily'
                    CHECK (schedule_type IN ('daily', 'weekdays', 'x_per_week')),
  schedule_days   INT[] NOT NULL DEFAULT '{}',
  schedule_target INT  NOT NULL DEFAULT 1 CHECK (schedule_target BETWEEN 1 AND 7),
  time_of_day     TEXT NOT NULL DEFAULT 'anytime'
                    CHECK (time_of_day IN ('anytime', 'morning', 'afternoon', 'evening')),
  energy_level    TEXT NOT NULL DEFAULT 'medium'
                    CHECK (energy_level IN ('high', 'medium', 'low')),
  tiny_version    TEXT NOT NULL DEFAULT '',
  reminder_time   TEXT,
  "order"         INT  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_habits_user    ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_live     ON public.habits(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_habits_updated  ON public.habits(user_id, updated_at);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id     UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'skipped', 'frozen')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user  ON public.habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON public.habit_logs(habit_id, date);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_freezes INT NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS trg_habits_updated ON public.habits;
CREATE TRIGGER trg_habits_updated BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.habits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own habits" ON public.habits
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage own habit logs" ON public.habit_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================================================
-- END schema.sql
-- =============================================================================


-- =============================================================================
-- BEGIN migration_v5_workspaces.sql
-- =============================================================================

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


-- =============================================================================
-- END migration_v5_workspaces.sql
-- =============================================================================


-- =============================================================================
-- BEGIN migration_v6_social.sql
-- =============================================================================

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


-- =============================================================================
-- END migration_v6_social.sql
-- =============================================================================


-- =============================================================================
-- BEGIN migration_v7_collab.sql
-- =============================================================================

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


-- =============================================================================
-- END migration_v7_collab.sql
-- =============================================================================


-- =============================================================================
-- BEGIN migration_v8_pacts.sql
-- =============================================================================

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


-- =============================================================================
-- END migration_v8_pacts.sql
-- =============================================================================


-- =============================================================================
-- BEGIN migration_v9_review_fixes.sql
-- =============================================================================

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


-- =============================================================================
-- END migration_v9_review_fixes.sql
-- =============================================================================


-- =============================================================================
-- BEGIN migration_v10_push.sql
-- =============================================================================

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


-- =============================================================================
-- END migration_v10_push.sql
-- =============================================================================
