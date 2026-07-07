import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useInbox } from '../core/context/InboxContext';
import { useTasks } from '../core/context/TaskContext';
import { useAuth } from '../core/context/AuthContext';
import { useTheme } from '../core/context/ThemeContext';
import { api } from '../core/lib/api';
import type { Priority, EnergyLevel, Task } from '../core/types';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { EmptyState } from '../ui/EmptyState';
import { haptic } from '../core/utils/haptics';

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const ENERGIES: EnergyLevel[] = ['high', 'medium', 'low'];

export function ProcessInboxScreen() {
  const navigate = useNavigate();
  const { inboxTasks, captureTask, deleteInboxTask, removeInboxTask } = useInbox();
  const { addTask, addTaskLocal } = useTasks();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [memo, setMemo] = useState('');

  const total = inboxTasks.length;
  const current = inboxTasks[Math.min(index, Math.max(0, total - 1))] ?? null;

  const reset = () => { setExpanded(false); setTitle(''); setPriority('medium'); setEnergy('medium'); setDeadline(null); };
  useEffect(reset, [current?.id]);

  const advance = () => setIndex((p) => (total <= 1 ? 0 : Math.min(p, total - 2)));

  const makeTask = () => {
    if (!current) return;
    if (!expanded) { setTitle(current.rawText); setExpanded(true); return; }
    const t = title.trim();
    if (!t) return;
    const id = current.id;
    haptic('success');
    api.post<{ id: string; created_at: string }>(`/inbox/${id}/convert`, {
      title: t,
      priority,
      energy_level: energy,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
    }).then(({ data, isBackendDown }) => {
      if (!isBackendDown && data) {
        const now = Date.now();
        const nt: Task = {
          id: data.id, title: t, description: '', priority, energyLevel: energy, deadline,
          isCompleted: false, completedAt: null, createdAt: data.created_at ? new Date(data.created_at).getTime() : now,
          updatedAt: now, category: 'personal', deferCount: 0, createdHour: new Date().getHours(),
          overdueStartDate: null, revivedAt: null, archivedAt: null, isArchived: false, estimatedMinutes: null,
          actualMinutes: null, startedAt: null, parentId: null, childIds: [], depth: 0, isRecurring: false,
          recurringFrequency: null, scheduledStartAt: null, scheduledEndAt: null, userId: user?.id,
        };
        addTaskLocal(nt);
        removeInboxTask(id);
      } else {
        addTask(t, { priority, energyLevel: energy, deadline });
        removeInboxTask(id);
      }
    }).catch(() => { addTask(t, { priority, energyLevel: energy, deadline }); removeInboxTask(id); });
    reset();
    advance();
  };

  const quickComplete = () => {
    if (!current) return;
    const id = current.id;
    const raw = current.rawText;
    haptic('success');
    removeInboxTask(id);
    reset();
    advance();
    api.post(`/inbox/${id}/convert`, { title: raw, is_completed: true }).then(({ isBackendDown }) => {
      if (isBackendDown) addTask(raw, { isCompleted: true, completedAt: Date.now() });
    }).catch(() => addTask(raw, { isCompleted: true, completedAt: Date.now() }));
  };

  const discard = () => { if (!current) return; haptic('medium'); deleteInboxTask(current.id); reset(); advance(); };

  const seg = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: active ? 'var(--c-surface-dark)' : 'var(--c-gray50)',
    color: active ? 'var(--c-white)' : 'var(--c-gray500)',
    border: `1px solid ${active ? 'var(--c-surface-dark)' : 'var(--c-gray200)'}`,
    textTransform: 'capitalize',
  });

  const doneCount = 0; // triage is subtractive; show remaining

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', color: 'var(--c-text)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(var(--safe-top) + 12px) 20px 8px' }}>
        <Pressable onPress={() => navigate('/')} style={{ padding: 4 }}><Icon name="chevron-down" size={26} /></Pressable>
        <h1 style={{ fontSize: 22, fontWeight: 700, flex: 1 }}>Process Inbox</h1>
        {total > 0 && <span style={{ fontSize: 13, color: 'var(--c-text-tertiary)' }}>{total} left</span>}
      </header>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 20px' }}>
        {!current ? (
          <EmptyState title="Inbox zero" subtitle="Nothing left to process. Nice." icon="checkmark-done-circle" iconColor="#22C55E" />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {/* Memo card */}
              <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-light)', borderRadius: 'var(--r-card)', padding: 20, minHeight: 120, marginBottom: 16 }}>
                {expanded ? (
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Task title"
                    style={{ width: '100%', fontSize: 20, fontWeight: 700, background: 'transparent', color: 'var(--c-text)' }}
                  />
                ) : (
                  <div style={{ fontSize: 18, lineHeight: 1.5 }}>{current.rawText}</div>
                )}
              </div>

              {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                  <div>
                    <div style={label}>PRIORITY</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PRIORITIES.map((p) => <button key={p} style={seg(priority === p)} onClick={() => setPriority(p)}>{p}</button>)}
                    </div>
                  </div>
                  <div>
                    <div style={label}>ENERGY</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ENERGIES.map((e) => <button key={e} style={seg(energy === e)} onClick={() => setEnergy(e)}>{e}</button>)}
                    </div>
                  </div>
                  <div>
                    <div style={label}>DEADLINE</div>
                    <input
                      type="datetime-local"
                      value={deadline ? new Date(deadline - new Date(deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setDeadline(e.target.value ? new Date(e.target.value).getTime() : null)}
                      style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid var(--c-gray200)', background: 'var(--c-gray50)', color: 'var(--c-text)', colorScheme: isDark ? 'dark' : 'light', fontSize: 14 }}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Pressable onPress={makeTask} style={{ width: '100%', height: 52, borderRadius: 'var(--r-button)', background: 'var(--c-surface-dark)', color: 'var(--c-white)', fontSize: 16, fontWeight: 700, gap: 8 }}>
                  <Icon name="arrow-forward" size={18} color="#fff" /> {expanded ? 'Create task' : 'Make a task'}
                </Pressable>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Pressable onPress={quickComplete} style={{ flex: 1, height: 48, borderRadius: 'var(--r-button)', border: '1px solid var(--c-border)', gap: 8 }}>
                    <Icon name="checkmark" size={18} /> Done already
                  </Pressable>
                  <Pressable onPress={discard} style={{ flex: 1, height: 48, borderRadius: 'var(--r-button)', border: '1px solid var(--c-border)', gap: 8 }}>
                    <Icon name="trash-outline" size={18} /> Discard
                  </Pressable>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Add memo */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', paddingBottom: 'calc(var(--safe-bottom) + 12px)', borderTop: '1px solid var(--c-border-light)' }}>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && memo.trim()) { captureTask(memo.trim()); setMemo(''); } }}
          placeholder="Capture a thought…"
          style={{ flex: 1, height: 44, padding: '0 14px', borderRadius: 'var(--r-input)', background: 'var(--c-surface)', border: '1px solid var(--c-gray200)', color: 'var(--c-text)', fontSize: 15 }}
        />
        <Pressable onPress={() => { if (memo.trim()) { captureTask(memo.trim()); setMemo(''); } }} style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--c-surface-dark)' }}>
          <Icon name="add" size={22} color="var(--c-white)" />
        </Pressable>
      </div>
      {doneCount > 0 && null}
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '1px', color: 'var(--c-text-tertiary)', marginBottom: 6 };
