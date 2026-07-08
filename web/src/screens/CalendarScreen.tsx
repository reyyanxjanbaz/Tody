import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../core/context/TaskContext';
import { usePreferences } from '../app/PreferencesContext';
import { getDayboardData, formatCalendarTime, formatDayTitle, formatDaySubtitle, getTaskDurationMinutes } from '../core/utils/calendarDayboard';
import { formatMinutes } from '../core/utils/timeTracking';
import { startOfDay } from '../core/utils/dateUtils';
import type { Task } from '../core/types';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { Checkbox } from '../ui/Checkbox';
import { CalendarStrip } from '../components/CalendarStrip';
import { useWorkspaceFilter } from '../features/workspaces/useWorkspaceFilter';

const PRIORITY_BAR: Record<Task['priority'], string> = {
  high: 'var(--c-text)',
  medium: 'var(--c-gray500)',
  low: 'var(--c-gray200)',
  none: 'transparent',
};

export function CalendarScreen() {
  const navigate = useNavigate();
  const { tasks, activeCategory, completeTask } = useTasks();
  const { prefs } = usePreferences();
  const { filter: filterWs } = useWorkspaceFilter();
  const [selected, setSelected] = useState(() => startOfDay().getTime());

  const workspaceTasks = useMemo(() => filterWs(tasks), [filterWs, tasks]);
  const board = useMemo(() => getDayboardData(workspaceTasks, selected, activeCategory), [workspaceTasks, selected, activeCategory]);

  const row = (task: Task, meta?: string) => (
    // Container is a plain div (no role) so the Checkbox isn't an interactive
    // element nested inside another — a11y "nested-interactive". The title area
    // is the single navigable button; the checkbox is a sibling control.
    <div
      key={task.id}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', textAlign: 'left' }}
    >
      <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: PRIORITY_BAR[task.priority] }} />
      <span style={{ display: 'flex' }}>
        <Checkbox checked={task.isCompleted} onToggle={() => completeTask(task.id)} size={18} />
      </span>
      <button
        onClick={() => navigate(`/task/${task.id}`)}
        aria-label={`Open ${task.title}`}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
          {meta && <span style={{ display: 'block', fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 2 }}>{meta}</span>}
        </span>
        <Icon name="chevron-forward" size={16} color="var(--c-gray400)" />
      </button>
    </div>
  );

  const sectionLabel = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', color: 'var(--c-text-tertiary)', padding: '20px 20px 6px' }}>{t}</div>
  );

  const empty = board.committed.length === 0 && board.dueToday.length === 0 && board.flexible.length === 0 && board.renegotiation.length === 0;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', color: 'var(--c-text)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(var(--safe-top) + 12px) 16px 4px' }}>
        <Pressable onPress={() => navigate('/')} aria-label="Back to today" style={{ padding: 4 }}><Icon name="chevron-back" size={26} /></Pressable>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>{formatDayTitle(selected)}</div>
          <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>{formatDaySubtitle(selected)}</div>
        </div>
      </header>

      <CalendarStrip selectedDate={selected} onDateChange={setSelected} />

      <div style={{ padding: '4px 20px 12px', fontSize: 14, color: 'var(--c-text-secondary)' }}>{board.statusText}</div>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}>
        {empty && (
          <div style={{ textAlign: 'center', color: 'var(--c-text-tertiary)', padding: '48px 24px' }}>Nothing planned for this day.</div>
        )}

        {board.renegotiation.length > 0 && (
          <>
            {sectionLabel('NEEDS A RESET')}
            {board.renegotiation.map((t) => row(t, 'Overdue — swipe to revive on Home'))}
          </>
        )}

        {board.committed.length > 0 && (
          <>
            {sectionLabel('COMMITTED')}
            {board.committed.map((item) =>
              row(item.task, `${formatCalendarTime(item.startAt, prefs.timeFormat)}–${formatCalendarTime(item.endAt, prefs.timeFormat)} · ${item.kind}`),
            )}
          </>
        )}

        {board.dueToday.length > 0 && (
          <>
            {sectionLabel('DUE THIS DAY')}
            {board.dueToday.map((t) => row(t, t.deadline ? formatCalendarTime(t.deadline, prefs.timeFormat) : undefined))}
          </>
        )}

        {board.flexible.length > 0 && (
          <>
            {sectionLabel('FLEXIBLE')}
            {board.flexible.slice(0, 20).map((t) => row(t, `~${formatMinutes(getTaskDurationMinutes(t))}`))}
          </>
        )}
      </div>
    </div>
  );
}
