-- ════════════════════════════════════════════════════════════════════════════
-- Migration v4 — Habit tracker (Phase 5, classic streaks)
--
-- Adds `habits` + `habit_logs` tables and a `streak_freezes` bank column on
-- profiles. Idempotent: safe to run repeatedly. Day boundaries are the CLIENT's
-- local 'YYYY-MM-DD' day key (stored as text, never recomputed server-side).
-- ════════════════════════════════════════════════════════════════════════════

-- ── habits ───────────────────────────────────────────────────────────────────
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
  reminder_time   TEXT,                    -- 'HH:MM' local, or NULL
  "order"         INT  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ              -- soft-delete tombstone (cross-device)
);

CREATE INDEX IF NOT EXISTS idx_habits_user     ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_live      ON public.habits(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_habits_updated   ON public.habits(user_id, updated_at);

-- ── habit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id     UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,             -- client-local 'YYYY-MM-DD' day key
  status       TEXT NOT NULL DEFAULT 'done'
                 CHECK (status IN ('done', 'skipped', 'frozen')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user  ON public.habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON public.habit_logs(habit_id, date);

-- ── profiles.streak_freezes (bank, capped in app + API at 2) ─────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_freezes INT NOT NULL DEFAULT 0;

-- ── updated_at auto-touch (reuses the shared trigger function) ───────────────
DROP TRIGGER IF EXISTS trg_habits_updated ON public.habits;
CREATE TRIGGER trg_habits_updated BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.habits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own habits"   ON public.habits;
CREATE POLICY "Users can view own habits"   ON public.habits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own habits" ON public.habits;
CREATE POLICY "Users can insert own habits" ON public.habits FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own habits" ON public.habits;
CREATE POLICY "Users can update own habits" ON public.habits FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own habits" ON public.habits;
CREATE POLICY "Users can delete own habits" ON public.habits FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own habit logs"   ON public.habit_logs;
CREATE POLICY "Users can view own habit logs"   ON public.habit_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own habit logs" ON public.habit_logs;
CREATE POLICY "Users can insert own habit logs" ON public.habit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own habit logs" ON public.habit_logs;
CREATE POLICY "Users can update own habit logs" ON public.habit_logs FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own habit logs" ON public.habit_logs;
CREATE POLICY "Users can delete own habit logs" ON public.habit_logs FOR DELETE USING (auth.uid() = user_id);
