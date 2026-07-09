import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../core/context/TaskContext';
import { useAuth } from '../core/context/AuthContext';
import { Screen } from '../ui/Screen';
import { SectionHeader } from '../ui/SectionHeader';
import { EmptyState } from '../ui/EmptyState';
import { TaskItem } from '../components/TaskItem';
import type { Task } from '../core/types';

export function ArchiveScreen() {
  const navigate = useNavigate();
  const { tasks, archivedTasks, uncompleteTask } = useTasks();
  const { logout, user } = useAuth();
  const [query, setQuery] = useState('');

  const match = (t: Task) => {
    const q = query.toLowerCase().trim();
    return !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  };

  const completed = useMemo(
    () => tasks.filter((t) => t.isCompleted).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).filter(match),
    [tasks, query],
  );
  const archived = useMemo(
    () => [...archivedTasks].sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)).filter(match),
    [archivedTasks, query],
  );

  const sections = [
    ...(archived.length ? [{ title: 'OVERDUE ARCHIVED', data: archived }] : []),
    ...(completed.length ? [{ title: 'COMPLETED', data: completed }] : []),
  ];
  const total = tasks.filter((t) => t.isCompleted).length + archivedTasks.length;

  return (
    <Screen
      title="Archive"
      onBack={() => navigate(-1)}
      right={total > 0 ? <span style={{ fontSize: 12, color: 'var(--c-gray400)' }}>{total} items</span> : undefined}
    >
      <div style={{ padding: '0 24px 12px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search archived tasks..."
          style={{ height: 48, width: '100%', borderRadius: 'var(--r-input)', padding: '0 16px', background: 'var(--c-gray50)', color: 'var(--c-text)', fontSize: 16 }}
        />
      </div>

      {sections.length === 0 ? (
        <EmptyState
          title={query ? 'No results' : 'No archived tasks'}
          subtitle={query ? undefined : 'Completed and overdue-archived tasks appear here'}
          icon={query ? 'search-outline' : 'archive-outline'}
          iconColor="#F59E0B"
        />
      ) : (
        sections.map((s) => (
          <div key={s.title}>
            <SectionHeader title={s.title} count={s.data.length} />
            {s.data.map((t) => (
              <TaskItem key={t.id} task={t} onPress={() => navigate(`/task/${t.id}`)} onComplete={uncompleteTask} onDefer={() => {}} />
            ))}
          </div>
        ))
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <span style={{ fontSize: 12, color: 'var(--c-gray400)' }}>{user?.email}</span>
        <button onClick={() => logout()} style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-gray800)' }}>Sign out</button>
      </div>
    </Screen>
  );
}
