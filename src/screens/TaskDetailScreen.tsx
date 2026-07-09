import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useTasks } from '../core/context/TaskContext';
import { useTheme } from '../core/context/ThemeContext';
import { usePreferences } from '../app/PreferencesContext';
import { formatDate } from '../utils/formatWithPrefs';
import { formatMinutes, getElapsedMinutes } from '../core/utils/timeTracking';
import { isTaskLocked, getChildren, countDescendants } from '../core/utils/dependencyChains';
import type { Priority, EnergyLevel, RecurringFrequency } from '../core/types';
import { Alert } from '../lib/alert';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { Sheet } from '../ui/Modal';
import { CategoryPill } from '../ui/CategoryPill';
import { EnergyPill, PriorityPill, EstimatePill, DeadlinePill, TimeQuickPick, RecurrencePill } from '../components/ParameterPills';
import { DeadlineSnapper } from '../components/DeadlineSnapper';
import { TaskInput, type TaskInputParams } from '../components/TaskInput';
import { SnoozeMenu } from '../components/SnoozeMenu';
import { ChunkAssistant } from '../components/ChunkAssistant';
import { haptic } from '../core/utils/haptics';

export function TaskDetailScreen() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { colors, isDark } = useTheme();
  const { prefs } = usePreferences();
  const {
    tasks,
    getTask,
    updateTask,
    deleteTask,
    deleteTaskWithCascade,
    completeTask,
    uncompleteTask,
    startTask,
    completeTimedTask,
    deferTask,
    addSubtask,
    categories,
  } = useTasks();

  const task = getTask(id);
  const assignable = useMemo(() => categories.filter((c) => c.id !== 'overview'), [categories]);

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'none');
  const [energy, setEnergy] = useState<EnergyLevel>(task?.energyLevel ?? 'medium');
  const [category, setCategory] = useState(task?.category ?? 'personal');
  const [deadline, setDeadline] = useState<number | null>(task?.deadline ?? null);
  const [estimate, setEstimate] = useState<number | null>(task?.estimatedMinutes ?? null);
  const [recurrence, setRecurrence] = useState<RecurringFrequency | null>(task?.recurringFrequency ?? null);
  const [showTime, setShowTime] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [chunkOpen, setChunkOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setEnergy(task.energyLevel);
      setCategory(task.category ?? 'personal');
      setDeadline(task.deadline);
      setEstimate(task.estimatedMinutes ?? null);
      setRecurrence(task.recurringFrequency ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const children = useMemo(() => (task ? getChildren(task, tasks) : []), [task, tasks]);
  const locked = useMemo(() => (task ? isTaskLocked(task, tasks) : false), [task, tasks]);

  if (!task) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--c-background)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'calc(var(--safe-top) + 12px) 16px' }}>
          <Pressable onPress={() => navigate('/')}><Icon name="chevron-back" size={26} /></Pressable>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-gray500)' }}>
          Task not found
        </div>
      </div>
    );
  }

  const isInProgress = !!task.startedAt && !task.isCompleted;

  const saveTitle = () => { if (title.trim() && title !== task.title) updateTask(task.id, { title: title.trim() }); };
  const saveDesc = () => { if (description !== task.description) updateTask(task.id, { description }); };

  const toggleComplete = () => {
    if (task.isCompleted) { uncompleteTask(task.id); return; }
    if (locked) { Alert.alert('Locked', 'Complete all subtasks first.'); return; }
    haptic('success');
    completeTask(task.id);
  };

  const del = () => {
    const desc = countDescendants(task.id, tasks);
    const msg = desc > 0 ? `Delete task and ${desc} subtask${desc !== 1 ? 's' : ''}?` : 'This cannot be undone.';
    if (window.confirm(`Delete task\n\n${msg}`)) {
      desc > 0 ? deleteTaskWithCascade(task.id) : deleteTask(task.id);
      navigate('/');
    }
  };

  const inputBox: React.CSSProperties = { width: '100%', background: 'transparent', color: 'var(--c-text)', resize: 'none', fontFamily: 'var(--font)' };
  const actionRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', width: '100%', fontSize: 16, fontWeight: 500, textAlign: 'left' };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', color: 'var(--c-text)' }}>
      <div style={{ height: 'calc(var(--safe-top) + 44px)' }} />

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, padding: '4px 24px 24px' }}>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          placeholder="Task title"
          rows={1}
          style={{ ...inputBox, fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 8, minHeight: 36 }}
        />

        <div style={{ background: 'var(--c-gray50)', border: '1px solid var(--c-gray200)', borderRadius: 12, padding: 12, marginBottom: 16, minHeight: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="document-text-outline" size={14} color="var(--c-gray400)" />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--c-gray400)' }}>Notes</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDesc}
            placeholder="Add notes..."
            style={{ ...inputBox, fontSize: 16, color: 'var(--c-text-secondary)', minHeight: 90, lineHeight: 1.5 }}
          />
        </div>

        <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 10, marginBottom: 16 }}>
          <div className="tody-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            <EnergyPill value={energy} onChange={(e) => { setEnergy(e); updateTask(task.id, { energyLevel: e }); }} />
            <PriorityPill value={priority} onChange={(p) => { setPriority(p); updateTask(task.id, { priority: p }); }} />
            {assignable.length > 0 && (
              <CategoryPill value={category} categories={assignable} onChange={(c) => { setCategory(c); updateTask(task.id, { category: c }); }} />
            )}
            <EstimatePill value={estimate} onPress={() => { setShowTime((v) => !v); setShowDeadline(false); }} />
            <DeadlinePill value={deadline} onPress={() => { setShowDeadline((v) => !v); setShowTime(false); }} />
            <RecurrencePill value={recurrence} onChange={(r) => { setRecurrence(r); updateTask(task.id, { isRecurring: r != null, recurringFrequency: r }); }} />
          </div>

          {showTime && (
            <TimeQuickPick value={estimate} onChange={(m) => { setEstimate(m); updateTask(task.id, { estimatedMinutes: m }); }} onDone={() => setShowTime(false)} />
          )}
          {showDeadline && (
            <div>
              <DeadlineSnapper onSelectDeadline={(ts) => { setDeadline(ts); updateTask(task.id, { deadline: ts }); }} currentDeadline={deadline} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                <input
                  type="datetime-local"
                  value={deadline ? new Date(deadline - new Date(deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => { const v = e.target.value ? new Date(e.target.value).getTime() : null; setDeadline(v); updateTask(task.id, { deadline: v }); }}
                  style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--c-gray400)', background: 'var(--c-gray50)', color: 'var(--c-text)', colorScheme: isDark ? 'dark' : 'light', fontSize: 13 }}
                />
                {deadline != null && (
                  <button onClick={() => { setDeadline(null); updateTask(task.id, { deadline: null }); }}>
                    <Icon name="close-circle" size={20} color="var(--c-gray400)" />
                  </button>
                )}
                <button onClick={() => setShowDeadline(false)} style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 600 }}>Done</button>
              </div>
            </div>
          )}
        </div>

        {isInProgress && task.startedAt ? (
          <div style={infoRow}>
            <Icon name="play-circle" size={16} color="#22C55E" />
            <span style={infoText}>In progress — {formatMinutes(getElapsedMinutes(task.startedAt))} elapsed{task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}</span>
          </div>
        ) : task.isCompleted && task.actualMinutes ? (
          <div style={infoRow}>
            <Icon name="checkmark-circle" size={16} color="var(--c-gray500)" />
            <span style={infoText}>Took {formatMinutes(task.actualMinutes)}{task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}</span>
          </div>
        ) : null}
        {task.deferCount > 0 && (
          <div style={infoRow}>
            <Icon name="arrow-redo-outline" size={14} color="var(--c-gray400)" />
            <span style={infoText}>Deferred {task.deferCount} time{task.deferCount > 1 ? 's' : ''}</span>
          </div>
        )}
        <div style={infoRow}>
          <Icon name="calendar-outline" size={14} color="var(--c-gray400)" />
          <span style={infoText}>Created {formatDate(task.createdAt, prefs)}</span>
        </div>

        {(children.length > 0 || task.depth < 3) && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--c-border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--c-gray500)', marginBottom: 8 }}>Subtasks</div>
            {children.map((child) => (
              <button key={child.id} onClick={() => navigate(`/task/${child.id}`)} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 0 10px 4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, marginRight: 12, border: `1.5px solid ${child.isCompleted ? 'var(--c-surface-dark)' : 'var(--c-gray400)'}`, background: child.isCompleted ? 'var(--c-surface-dark)' : 'transparent' }} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 16, textDecoration: child.isCompleted ? 'line-through' : 'none', color: child.isCompleted ? 'var(--c-gray500)' : 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.title}</span>
                <Icon name="chevron-forward" size={14} color="var(--c-gray400)" />
              </button>
            ))}
            {task.depth < 3 && (
              <button onClick={() => setSubtaskOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0', color: 'var(--c-gray400)', fontSize: 15 }}>
                <Icon name="add-circle-outline" size={16} color="var(--c-gray400)" /> Add subtask
              </button>
            )}
            {/* "Break it down" — offered on heavy tasks where activation energy is the wall */}
            {task.depth < 3 && children.length === 0 && ((task.estimatedMinutes ?? 0) > 60 || task.energyLevel === 'high') && (
              <button onClick={() => { haptic('medium'); setChunkOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', marginTop: 6, borderRadius: 10, background: 'var(--c-gray50)', border: '1px solid var(--c-gray200)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, width: '100%' }}>
                <Icon name="cut-outline" size={16} color="#8B5CF6" /> Break it down into steps
              </button>
            )}
            {locked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Icon name="lock-closed" size={13} color="var(--c-gray400)" />
                <span style={{ fontSize: 12, color: 'var(--c-gray400)' }}>Complete all subtasks to unlock</span>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--c-border)' }}>
          {!task.isCompleted && !task.startedAt && (
            <button style={actionRow} onClick={() => { haptic('medium'); startTask(task.id); }}>
              <Icon name="play-outline" size={18} color={colors.text} /> Start timer
            </button>
          )}
          {!task.isCompleted && task.startedAt && (
            <button style={actionRow} onClick={() => { haptic('success'); completeTimedTask(task.id); }}>
              <Icon name="stop-outline" size={18} color={colors.text} /> Complete (stop timer)
            </button>
          )}
          <button style={actionRow} onClick={toggleComplete}>
            <Icon name={task.isCompleted ? 'arrow-undo-outline' : 'checkmark-done-outline'} size={18} color={colors.text} />
            {task.isCompleted ? 'Restore task' : locked ? 'Mark as done (locked)' : 'Mark as done'}
          </button>
          {!task.isCompleted && (
            <button style={actionRow} onClick={() => { haptic('selection'); setSnoozeOpen(true); }}>
              <Icon name="time-outline" size={18} color={colors.text} /> Snooze
            </button>
          )}
          {task.parentId && (
            <button style={{ ...actionRow, color: 'var(--c-gray500)' }} onClick={() => navigate(`/task/${task.parentId}`)}>
              <Icon name="arrow-up-outline" size={18} color="var(--c-gray500)" /> Go to parent task
            </button>
          )}
        </div>
      </div>

      <SnoozeMenu open={snoozeOpen} onClose={() => setSnoozeOpen(false)} onSelect={(opt) => deferTask(task.id, opt)} />
      <ChunkAssistant open={chunkOpen} onClose={() => setChunkOpen(false)} onAdd={(t) => addSubtask(task.id, t)} taskTitle={task.title} />

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '16px 24px', paddingBottom: 'calc(var(--safe-bottom) + 16px)', borderTop: '1px solid var(--c-border)' }}>
        <Pressable onPress={() => { saveTitle(); saveDesc(); navigate('/'); }} style={bottomBtn}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={del} style={bottomBtn}>
          <Icon name="trash-outline" size={20} color={colors.text} />
        </Pressable>
      </div>

      <AnimatePresence>
        {subtaskOpen && (
          <Sheet open={subtaskOpen} onClose={() => setSubtaskOpen(false)}>
            <div style={{ padding: '8px 0 16px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, padding: '4px 16px 8px', color: 'var(--c-text-secondary)' }}>New subtask</div>
              <TaskInput
                compact
                autoFocus
                defaultCategory={task.category ?? 'personal'}
                categories={assignable}
                onSubmit={(text: string, params?: TaskInputParams) => {
                  const trimmed = text.trim();
                  if (trimmed) {
                    addSubtask(task.id, trimmed, {
                      ...(params?.estimatedMinutes ? { estimatedMinutes: params.estimatedMinutes } : {}),
                      ...(params?.energyLevel ? { energyLevel: params.energyLevel } : {}),
                      ...(params?.priority && params.priority !== 'none' ? { priority: params.priority } : {}),
                      ...(params?.deadline != null ? { deadline: params.deadline } : {}),
                      ...(params?.category ? { category: params.category } : {}),
                    });
                  }
                  setSubtaskOpen(false);
                }}
              />
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 6px)', left: 12 }}>
        <Pressable onPress={() => { saveTitle(); saveDesc(); navigate('/'); }} style={{ padding: 6 }}>
          <Icon name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      </div>
    </div>
  );
}

const infoRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' };
const infoText: React.CSSProperties = { fontSize: 13, color: 'var(--c-gray500)' };
const bottomBtn: React.CSSProperties = { width: 52, height: 52, background: 'var(--c-surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--c-border)' };
