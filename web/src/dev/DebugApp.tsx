import { useState } from 'react';
import { useAuth } from '../core/context/AuthContext';
import { useTasks } from '../core/context/TaskContext';
import { useInbox } from '../core/context/InboxContext';
import { useTheme } from '../core/context/ThemeContext';

/**
 * Phase-1 headless checkpoint harness. NOT the real UI — a throwaway panel to
 * verify that the ported logic layer (auth + task CRUD + localStorage
 * persistence + Supabase/backend sync) works before building screens.
 */
export function DebugApp() {
  const { user, isLoading, error, login, register, logout } = useAuth();
  const { tasks, addTask, completeTask, deferTask, deleteTask, isLoading: tasksLoading } = useTasks();
  const { inboxCount, captureTask } = useInbox();
  const { isDark, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');

  const box: React.CSSProperties = {
    maxWidth: 520,
    margin: '0 auto',
    padding: 20,
    fontFamily: 'var(--font)',
    color: 'var(--c-text)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
    height: '100%',
  };
  const input: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--c-border)',
    background: 'var(--c-surface)',
    color: 'var(--c-text)',
  };
  const btn: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    background: 'var(--c-text)',
    color: 'var(--c-background)',
    fontWeight: 600,
  };

  return (
    <div style={box}>
      <h1 style={{ fontSize: 28, letterSpacing: -0.5 }}>ToDy · debug checkpoint</h1>
      <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={toggleTheme}>
        theme: {isDark ? 'dark' : 'light'} (tap to toggle)
      </button>

      <section style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
        <strong>Auth</strong>{' '}
        {isLoading ? '…' : user ? `✓ ${user.email}` : 'logged out'}
        {error && <div style={{ color: '#e66' }}>error: {error}</div>}
        {!user && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <input style={input} placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              style={input}
              placeholder="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} onClick={() => login(email, password)}>login</button>
              <button style={btn} onClick={() => register(email, password)}>register</button>
            </div>
          </div>
        )}
        {user && (
          <button style={{ ...btn, marginTop: 8 }} onClick={() => logout()}>logout</button>
        )}
      </section>

      <section style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
        <strong>Tasks</strong> {tasksLoading ? '(loading…)' : `(${tasks.length})`} · inbox {inboxCount}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            style={{ ...input, flex: 1 }}
            placeholder="new task — try 'Email boss !high tomorrow 3pm'"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) {
                addTask(title.trim());
                setTitle('');
              }
            }}
          />
          <button
            style={btn}
            onClick={() => {
              if (title.trim()) {
                addTask(title.trim());
                setTitle('');
              }
            }}
          >
            add
          </button>
          <button style={btn} onClick={() => title.trim() && (captureTask(title.trim()), setTitle(''))}>
            → inbox
          </button>
        </div>

        <ul style={{ listStyle: 'none', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map((t) => (
            <li
              key={t.id}
              style={{
                padding: 10,
                borderRadius: 10,
                background: 'var(--c-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ flex: 1, textDecoration: t.isCompleted ? 'line-through' : 'none' }}>
                {t.priority !== 'none' && <em>[{t.priority}] </em>}
                {t.title}
                {t.deadline && (
                  <small style={{ color: 'var(--c-text-tertiary)' }}>
                    {' '}
                    · {new Date(t.deadline).toLocaleString()}
                  </small>
                )}
              </span>
              <button onClick={() => completeTask(t.id)} title="complete">✓</button>
              <button onClick={() => deferTask(t.id)} title="defer">→</button>
              <button onClick={() => deleteTask(t.id)} title="delete">✕</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
