-- ═══════════════════════════════════════════════════════════════════════════
-- TODY — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Requires: Supabase Auth enabled (it is by default)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Custom Enums ─────────────────────────────────────────────────────────

CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low', 'none');
CREATE TYPE energy_level  AS ENUM ('high', 'medium', 'low');
CREATE TYPE recurring_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');
CREATE TYPE date_format_type AS ENUM ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD');
CREATE TYPE time_format_type AS ENUM ('12h', '24h');
CREATE TYPE week_start_type AS ENUM ('sunday', 'monday');

-- ── 2. Profiles (extends auth.users) ────────────────────────────────────────

CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  avatar_url   TEXT,
  -- Preferences (stored inline — single row per user, no need for a separate table)
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
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 3. Categories ───────────────────────────────────────────────────────────

CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'grid-outline',       -- Ionicons name
  color       TEXT NOT NULL DEFAULT '#3B82F6',             -- Hex accent
  is_default  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_user ON public.categories(user_id);

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
    (NEW.id, 'Health',    'heart-outline',      '#10B981', false, 3);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_seed_categories
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_categories();

-- ── 4. Tasks ────────────────────────────────────────────────────────────────

CREATE TABLE public.tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  -- Core fields
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  priority            task_priority NOT NULL DEFAULT 'none',
  energy_level        energy_level  NOT NULL DEFAULT 'medium',

  -- Status
  is_completed        BOOLEAN NOT NULL DEFAULT false,
  completed_at        TIMESTAMPTZ,

  -- Scheduling
  deadline            TIMESTAMPTZ,
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  recurring_frequency recurring_frequency,
  defer_count         INT NOT NULL DEFAULT 0,
  created_hour        SMALLINT NOT NULL DEFAULT 0,  -- 0-23

  -- Overdue / Archive
  overdue_start_date  TIMESTAMPTZ,
  revived_at          TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  is_archived         BOOLEAN NOT NULL DEFAULT false,

  -- Time Block Integrity
  estimated_minutes   INT,
  actual_minutes      INT,
  started_at          TIMESTAMPTZ,

  -- Dependency Chains (self-referential hierarchy)
  parent_id           UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  depth               SMALLINT NOT NULL DEFAULT 0,  -- 0 = root, max 3

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT depth_max CHECK (depth >= 0 AND depth <= 3),
  CONSTRAINT created_hour_range CHECK (created_hour >= 0 AND created_hour <= 23)
);

CREATE INDEX idx_tasks_user          ON public.tasks(user_id);
CREATE INDEX idx_tasks_category      ON public.tasks(category_id);
CREATE INDEX idx_tasks_parent        ON public.tasks(parent_id);
CREATE INDEX idx_tasks_deadline      ON public.tasks(user_id, deadline)   WHERE deadline IS NOT NULL;
CREATE INDEX idx_tasks_completed     ON public.tasks(user_id, is_completed, completed_at);
CREATE INDEX idx_tasks_archived      ON public.tasks(user_id, is_archived) WHERE is_archived = true;

-- ── 5. Inbox Tasks (Quick Capture) ─────────────────────────────────────────

CREATE TABLE public.inbox_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_text     TEXT NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_user ON public.inbox_tasks(user_id);

-- ── 6. Task Patterns (Time Estimation Learning) ────────────────────────────

CREATE TABLE public.task_patterns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords                TEXT[] NOT NULL DEFAULT '{}',
  average_actual_minutes  INT NOT NULL DEFAULT 0,
  sample_size             INT NOT NULL DEFAULT 0,
  accuracy_score          INT NOT NULL DEFAULT 50,  -- 0-100
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patterns_user ON public.task_patterns(user_id);

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

CREATE TRIGGER trg_profiles_updated      BEFORE UPDATE ON public.profiles      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_categories_updated    BEFORE UPDATE ON public.categories    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated         BEFORE UPDATE ON public.tasks         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_task_patterns_updated BEFORE UPDATE ON public.task_patterns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Every table is locked down so users can only access their own data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT is handled by the trigger (SECURITY DEFINER), no direct insert needed.
-- DELETE is handled by cascading from auth.users.

-- ── Categories ──────────────────────────────────────────────────────────────

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- ── Tasks ───────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ── Inbox Tasks ─────────────────────────────────────────────────────────────

ALTER TABLE public.inbox_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inbox"
  ON public.inbox_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into own inbox"
  ON public.inbox_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own inbox tasks"
  ON public.inbox_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ── Task Patterns ───────────────────────────────────────────────────────────

ALTER TABLE public.task_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
  ON public.task_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
  ON public.task_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
  ON public.task_patterns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns"
  ON public.task_patterns FOR DELETE
  USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER VIEWS (optional but useful)
-- ═══════════════════════════════════════════════════════════════════════════

-- Children of a task (replaces the in-memory `childIds` array)
CREATE OR REPLACE VIEW public.task_children AS
SELECT
  parent_id,
  array_agg(id ORDER BY created_at) AS child_ids
FROM public.tasks
WHERE parent_id IS NOT NULL
GROUP BY parent_id;

-- Quick stats per user (for profile page)
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
  )                                                            AS completion_percentage
FROM public.tasks
GROUP BY user_id;


-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET (for avatar uploads)
-- ═══════════════════════════════════════════════════════════════════════════

-- Create a public bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow users to upload/update/delete their own avatar
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

-- Anyone can view avatars (public bucket)
CREATE POLICY "Avatars are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
