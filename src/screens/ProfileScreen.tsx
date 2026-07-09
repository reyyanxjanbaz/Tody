import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../core/context/AuthContext';
import { useTasks } from '../core/context/TaskContext';
import { useTheme } from '../core/context/ThemeContext';
import { usePreferences } from '../app/PreferencesContext';
import { calculateXP, getMonthCalendarData } from '../core/utils/profileStats';
import { useHabits } from '../core/context/HabitContext';
import { getAvatarUri, saveAvatarUri } from '../core/utils/storage';
import { formatMinutes } from '../core/utils/timeTracking';
import { api } from '../core/lib/api';
import type { Task } from '../core/types';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { PromptModal } from '../ui/PromptModal';
import { haptic } from '../core/utils/haptics';
import { PerformanceFusionSection } from '../components/profile/PerformanceFusionSection';
import { SwipeHabitsSection } from '../components/profile/SwipeHabitsSection';
import { FriendsCard } from '../features/social/FriendsCard';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW_SUNDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_MONDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Local streak fallback when the backend is unreachable. */
function localStreak(tasks: Task[]): number {
  const days = new Set(
    tasks.filter((t) => t.isCompleted && t.completedAt).map((t) => {
      const d = new Date(t.completedAt!);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );
  let streak = 0;
  const cur = new Date();
  for (;;) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
    if (days.has(key)) streak++;
    else if (streak > 0 || cur.toDateString() !== new Date().toDateString()) break;
    cur.setDate(cur.getDate() - 1);
    if (streak > 400) break;
  }
  return streak;
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const { tasks, archivedTasks } = useTasks();
  const { habitXP } = useHabits();
  const { isDark } = useTheme();
  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);

  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarPrompt, setAvatarPrompt] = useState(false);
  const [streak, setStreak] = useState(0);
  const [backendStats, setBackendStats] = useState<{ completion: number; total: number; minutes: number } | null>(null);

  useEffect(() => {
    (async () => {
      const uri = await getAvatarUri();
      if (uri) setAvatar(uri);
    })();
    setStreak(localStreak(allTasks));
    Promise.all([
      api.get<{ current_streak?: number }>('/profile/analytics'),
      api.get<{ completion_percentage?: number; total_created?: number; total_minutes_spent?: number }>('/profile/stats'),
    ]).then(([a, s]) => {
      if (a.data?.current_streak != null) setStreak(a.data.current_streak);
      if (s.data) setBackendStats({ completion: s.data.completion_percentage ?? 0, total: s.data.total_created ?? 0, minutes: s.data.total_minutes_spent ?? 0 });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Habits contribute to XP too (P5): every done-log is +5 via extraXP.
  const xp = useMemo(() => calculateXP(allTasks, streak, habitXP), [allTasks, streak, habitXP]);
  const displayName = (user?.email ?? '').split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  // Local stats fallback
  const stats = backendStats ?? {
    completion: allTasks.length ? Math.round((allTasks.filter((t) => t.isCompleted).length / allTasks.length) * 100) : 0,
    total: allTasks.length,
    minutes: allTasks.reduce((s, t) => s + (t.isCompleted ? t.actualMinutes ?? 0 : 0), 0),
  };

  // Monthly calendar
  const [ym, setYm] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const today = new Date();
  const calData = useMemo(() => getMonthCalendarData(allTasks, ym.y, ym.m), [allTasks, ym]);
  // Leading blanks so the 1st lands under the right weekday column, honoring
  // the user's week-start preference (Sunday-first vs Monday-first).
  const mondayFirst = prefs.weekStartsOn === 'monday';
  const dow = mondayFirst ? DOW_MONDAY : DOW_SUNDAY;
  const rawFirstDow = new Date(ym.y, ym.m, 1).getDay(); // 0=Sun..6=Sat
  const offset = mondayFirst ? (rawFirstDow + 6) % 7 : rawFirstDow;
  const cells = [...Array(offset).fill(null), ...calData];
  const isCurMonth = ym.y === today.getFullYear() && ym.m === today.getMonth();
  const shiftMonth = (d: number) => { haptic('light'); setYm((p) => { const nm = p.m + d; return { y: p.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 }; }); };

  const card: React.CSSProperties = { margin: '0 24px 20px', background: 'var(--c-surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--c-border-light)', padding: 16 };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', color: 'var(--c-text)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(var(--safe-top) + 12px) 24px 12px' }}>
        <Pressable onPress={() => navigate(-1)} style={{ padding: 4 }}><Icon name="chevron-back" size={26} /></Pressable>
        <span style={{ fontSize: 16, fontWeight: 500 }}>Profile</span>
        <Pressable onPress={() => navigate('/settings')} style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--c-surface-dark)' }}>
          <Icon name="settings-outline" size={18} color="var(--c-white)" />
        </Pressable>
      </header>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        {/* Profile header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 24px' }}>
          <button onClick={() => { haptic('light'); setAvatarPrompt(true); }} style={{ position: 'relative', marginBottom: 16 }}>
            {avatar ? (
              <img src={avatar} alt="" style={{ width: 80, height: 80, borderRadius: 40, objectFit: 'cover', background: 'var(--c-gray100)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: 40, background: 'var(--c-surface-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--c-white)', letterSpacing: 1 }}>{initials}</div>
            )}
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, background: 'var(--c-gray800)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid var(--c-background)` }}>
              <Icon name="camera-outline" size={12} color={isDark ? '#000' : '#fff'} />
            </span>
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>{displayName}</div>
          <div style={{ fontSize: 14, color: 'var(--c-text-tertiary)', marginTop: 2 }}>{user?.email}</div>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, background: 'var(--c-surface)', padding: '8px 16px', borderRadius: 'var(--r-pill)' }}>
              <Icon name="flame-outline" size={18} /> <b style={{ fontSize: 16 }}>{streak}</b> <span style={{ fontSize: 14, color: 'var(--c-text-secondary)' }}>day streak</span>
            </div>
          )}
        </div>

        {/* XP */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--c-surface-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, fontSize: 18, fontWeight: 800, color: 'var(--c-white)' }}>{xp.level}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Level {xp.level}</div>
              <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 1 }}>{xp.xpInCurrentLevel} / {xp.xpForNextLevel} XP</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{xp.totalXP} XP</div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--c-gray200)', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${xp.progressPercent}%` }} transition={{ type: 'spring', damping: 20, stiffness: 300 }} style={{ height: '100%', borderRadius: 3, background: isDark ? 'var(--c-white)' : 'var(--c-surface-dark)' }} />
          </div>
        </div>

        {/* Friends / weekly leaderboard */}
        <FriendsCard />

        {/* Monthly calendar */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={() => shiftMonth(-1)} style={{ padding: 4 }}><Icon name="chevron-back" size={20} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{MONTHS[ym.m]} {ym.y}</span>
              {!isCurMonth && (
                <button onClick={() => setYm({ y: today.getFullYear(), m: today.getMonth() })} style={{ background: isDark ? '#F5F5F7' : 'var(--c-surface-dark)', color: isDark ? '#000' : '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>Today</button>
              )}
            </div>
            <button onClick={() => shiftMonth(1)} style={{ padding: 4 }}><Icon name="chevron-forward" size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {dow.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--c-text-tertiary)', padding: '4px 0' }}>{d}</div>)}
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const d = new Date(cell.date);
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', minHeight: 40, justifyContent: 'center' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? (isDark ? 'var(--c-white)' : 'var(--c-surface-dark)') : 'transparent' }}>
                    <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? (isDark ? '#000' : '#fff') : 'var(--c-text)' }}>{d.getDate()}</span>
                  </div>
                  {cell.allDone ? (
                    <span style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 2, background: isDark ? 'var(--c-white)' : 'var(--c-surface-dark)' }} />
                  ) : cell.hasIncomplete ? (
                    <span style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 2, border: '1px solid var(--c-gray500)' }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Performance story */}
        <PerformanceFusionSection tasks={allTasks} currentStreak={streak} />

        {/* Quick-action insight */}
        <SwipeHabitsSection />

        {/* Stats */}
        <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { v: `${stats.completion}%`, l: 'Completed' },
            { v: String(stats.total), l: 'Total tasks' },
            { v: formatMinutes(stats.minutes), l: 'Time invested' },
          ].map((s) => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <PromptModal
        visible={avatarPrompt}
        title="Set Avatar"
        message="Paste an image URL (or leave blank to remove)"
        defaultValue={avatar ?? ''}
        onCancel={() => setAvatarPrompt(false)}
        onSubmit={async (v) => {
          setAvatarPrompt(false);
          const url = v.trim();
          setAvatar(url || null);
          await saveAvatarUri(url);
          api.patch('/profile', { avatar_url: url || null }).catch(() => {});
          haptic('success');
        }}
      />
    </div>
  );
}
