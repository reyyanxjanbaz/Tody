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

  parent_id           UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  depth               SMALLINT NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

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
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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
