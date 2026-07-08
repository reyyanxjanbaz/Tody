import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { STAGGER_LIST, STAGGER_LIST_MAX, DUR_QUICK } from '../theme/motion';
import { useTasks } from '../core/context/TaskContext';
import { useAuth } from '../core/context/AuthContext';
import { useInbox } from '../core/context/InboxContext';
import { useTheme } from '../core/context/ThemeContext';
import { organizeTasks, searchTasks } from '../core/utils/taskIntelligence';
import { flattenTasksHierarchically, isTaskLocked } from '../core/utils/dependencyChains';
import type { Task, EnergyLevel } from '../core/types';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { PromptModal } from '../ui/PromptModal';
import { EmptyState } from '../ui/EmptyState';
import { SectionHeader } from '../ui/SectionHeader';
import { TodayLine } from '../ui/TodayLine';
import { useUndo } from '../components/UndoToast';
import { TaskItem } from '../components/TaskItem';
import { TaskInput, type TaskInputParams } from '../components/TaskInput';
import { CategoryTabs } from '../components/CategoryTabs';
import { FocusMode } from '../components/FocusMode';
import { TaskPreviewOverlay } from '../components/TaskPreviewOverlay';
import { SortDropdown } from '../components/SortDropdown';
import { ManageCategoriesModal } from '../components/ManageCategoriesModal';
import { ZeroStateOnboarding } from '../components/ZeroStateOnboarding';
import { EnergyFilter } from '../components/EnergyFilter';
import { SnoozeMenu } from '../components/SnoozeMenu';
import { PlanningRitual } from '../components/PlanningRitual';
import { getFocusList } from '../utils/focusList';
import { sortTasks } from '../core/utils/sortTasks';
import type { SortOption } from '../core/types';
import { useWorkspaceFilter } from '../features/workspaces/useWorkspaceFilter';
import { workspaceIdForDb } from '../features/workspaces/types';
import { WorkspaceSwitcher } from '../features/workspaces/WorkspaceSwitcher';
import { useCollab } from '../features/collab/CollabContext';
import { AssigneePicker } from '../features/collab/AssigneePicker';
import { haptic } from '../core/utils/haptics';

interface TreeRow {
  task: Task;
  isLastChild: boolean;
  ancestorContinuation: boolean[];
}

/** Compute subtask connector metadata for a hierarchically-flattened list. */
function buildTreeRows(tasks: Task[]): TreeRow[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const siblingsOf = (t: Task): Task[] => {
    if (!t.parentId) return [];
    const parent = byId.get(t.parentId);
    if (!parent) return [];
    return (parent.childIds ?? [])
      .map((id) => byId.get(id))
      .filter((x): x is Task => !!x)
      .sort((a, b) => a.createdAt - b.createdAt);
  };
  const isLast = (t: Task): boolean => {
    const sibs = siblingsOf(t);
    return sibs.length === 0 || sibs[sibs.length - 1].id === t.id;
  };
  return tasks.map((task) => {
    const cont: boolean[] = [];
    let cur: Task | undefined = task;
    // Walk ancestors; for each, line continues if that ancestor is not its parent's last child
    const chain: Task[] = [];
    while (cur?.parentId) {
      const p = byId.get(cur.parentId);
      if (!p) break;
      chain.unshift(cur);
      cur = p;
    }
    for (let i = 0; i < chain.length - 1; i++) cont.push(!isLast(chain[i]));
    return { task, isLastChild: isLast(task), ancestorContinuation: cont };
  });
}

export function HomeScreen() {
  const navigate = useNavigate();
  const {
    tasks,
    addTask,
    completeTask,
    deferTask,
    reviveTask,
    startTask,
    completeTimedTask,
    uncompleteTask,
    deleteTaskWithCascade,
    categories,
    activeCategory,
    setActiveCategory,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  } = useTasks();
  const { inboxCount } = useInbox();
  const { isDark, toggleTheme } = useTheme();
  const { showUndo } = useUndo();
  const { activeWorkspaceId, filter: filterWs } = useWorkspaceFilter();
  const { isSharedWorkspace, membersById } = useCollab();
  const { user } = useAuth();
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [assignedToMe, setAssignedToMe] = useState(false);
  const assigneeFor = (t: Task) => (isSharedWorkspace && t.assigneeId ? membersById[t.assigneeId] ?? null : null);

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [managingCats, setManagingCats] = useState(false);
  const [scratchStart, setScratchStart] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>(
    () => (localStorage.getItem('tody:sortOption') as SortOption) || 'default',
  );
  const setSort = (o: SortOption) => {
    setSortOption(o);
    try { localStorage.setItem('tody:sortOption', o); } catch { /* ignore */ }
    setSortOpen(false);
  };

  // Cascade the list in on the screen's very first paint only; after that,
  // freshly-added rows fade in on their own (no re-stagger on filter/sort).
  const firstLoad = useRef(true);
  useEffect(() => { firstLoad.current = false; }, []);
  const entranceDelay = (i: number) =>
    firstLoad.current ? Math.min(i, STAGGER_LIST_MAX) * STAGGER_LIST : 0;

  const assignableCats = useMemo(() => categories.filter((c) => c.id !== 'overview'), [categories]);

  // Scope to the active workspace first, then (in shared workspaces) optionally
  // to tasks assigned to me, then category, then current-energy.
  const workspaceTasks = useMemo(() => {
    const ws = filterWs(tasks);
    if (assignedToMe && isSharedWorkspace && user) return ws.filter((t) => t.assigneeId === user.id);
    return ws;
  }, [filterWs, tasks, assignedToMe, isSharedWorkspace, user]);
  const visibleTasks = useMemo(() => {
    const byCat = activeCategory === 'overview' ? workspaceTasks : workspaceTasks.filter((t) => t.category === activeCategory);
    if (!energyFilter) return byCat;
    return byCat.filter((t) => t.energyLevel === energyFilter);
  }, [workspaceTasks, activeCategory, energyFilter]);

  const sections = useMemo(() => organizeTasks(visibleTasks), [visibleTasks]);
  // Search is scoped to the active workspace (a workspace should feel self-contained).
  const searchResults = useMemo(() => (query.trim() ? searchTasks(workspaceTasks, query) : []), [workspaceTasks, query]);

  // Top-3 tasks for Focus mode: the first uncompleted root tasks in urgency
  // order across the organized sections.
  const focusTasks = useMemo(() => {
    const open = sections.flatMap((s) => s.data).filter((t) => !t.isCompleted && !t.parentId);
    // Prefer the day's ritual-chosen top-3 (P6.2); fall back to urgency order.
    const chosen = getFocusList().map((id) => open.find((t) => t.id === id)).filter(Boolean) as Task[];
    return (chosen.length > 0 ? chosen : open).slice(0, 3);
  }, [sections]);

  const handleAdd = (text: string, params?: TaskInputParams) => {
    addTask(text, {
      energyLevel: params?.energyLevel ?? 'medium',
      priority: params?.priority ?? 'none',
      estimatedMinutes: params?.estimatedMinutes ?? null,
      deadline: params?.deadline ?? null,
      category: params?.category ?? (activeCategory !== 'overview' ? activeCategory : 'personal'),
      isRecurring: params?.isRecurring ?? false,
      recurringFrequency: params?.recurringFrequency ?? null,
      workspaceId: workspaceIdForDb(activeWorkspaceId),
    });
  };

  const onComplete = (id: string) => {
    completeTask(id);
    showUndo('Task completed', () => uncompleteTask(id), { icon: 'checkmark-circle', iconColor: '#22C55E' });
  };
  const onDelete = (t: Task) => {
    setMenuTask(null);
    deleteTaskWithCascade(t.id);
    showUndo('Task deleted', () => {}, { icon: 'trash-outline' });
  };

  const openTask = (t: Task) => navigate(`/task/${t.id}`);

  const isEmpty = sections.length === 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        // Hidden while Focus mode is active — the overlay is portalled to
        // <body>, so removing the list from layout leaves only the focus surface
        // (and stops off-screen tasks from counting as "visible").
        display: focusMode ? 'none' : 'flex',
        flexDirection: 'column',
        background: 'var(--c-background)',
        paddingTop: 'var(--safe-top)',
      }}
    >
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px 6px' }}>
        {searching ? (
          <>
            <Icon name="search-outline" size={20} color="var(--c-gray500)" />
            <input
              autoFocus
              value={query}
              placeholder="Search tasks"
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, fontSize: 18, background: 'transparent', marginLeft: 8 }}
            />
            <Pressable onPress={() => { setSearching(false); setQuery(''); }} style={{ padding: 6 }}>
              <Icon name="close" size={22} />
            </Pressable>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.6px' }}>Today</h1>
              <WorkspaceSwitcher />
            </div>
            {focusTasks.length > 0 && (
              <Pressable onPress={() => setFocusMode(true)} aria-label="Focus" style={{ padding: 6 }}>
                <Icon name="flame-outline" size={22} />
              </Pressable>
            )}
            <Pressable onPress={() => setSortOpen(true)} aria-label="Sort" style={{ padding: 6 }}>
              <Icon name={sortOption === 'default' ? 'swap-vertical-outline' : 'swap-vertical'} size={22} />
            </Pressable>
            <Pressable onPress={() => setSearching(true)} aria-label="Search" style={{ padding: 6 }}>
              <Icon name="search-outline" size={22} />
            </Pressable>
            <Pressable onPress={() => navigate('/process-inbox')} aria-label="Inbox" style={{ padding: 6, position: 'relative' }}>
              <Icon name="file-tray-outline" size={22} />
              {inboxCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {inboxCount}
                </span>
              )}
            </Pressable>
            <Pressable onPress={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} style={{ padding: 6 }}>
              <Icon name={isDark ? 'sunny-outline' : 'moon-outline'} size={22} />
            </Pressable>
          </>
        )}
      </header>

      {!searching && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onAddPress={() => setAddingCat(true)}
          onManagePress={() => setManagingCats(true)}
        />
      )}

      {!searching && isSharedWorkspace && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 4px' }}>
          <Pressable
            onPress={() => { haptic('selection'); setAssignedToMe((v) => !v); }}
            hapticStyle={null}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 15,
              background: assignedToMe ? 'var(--c-text)' : 'var(--c-gray50)',
              border: '1px solid var(--c-border-light)',
            }}
          >
            <Icon name="person-outline" size={14} color={assignedToMe ? 'var(--c-background)' : 'var(--c-text-secondary)'} />
            <span style={{ fontSize: 12, fontWeight: 600, color: assignedToMe ? 'var(--c-background)' : 'var(--c-text-secondary)' }}>Assigned to me</span>
          </Pressable>
        </div>
      )}

      {!searching && workspaceTasks.length > 0 && (
        <EnergyFilter value={energyFilter} onChange={setEnergyFilter} />
      )}

      {/* List. Keyed on the active workspace so switching refocuses with a quick
          crossfade (the filtering itself is instant). */}
      <motion.div
        key={activeWorkspaceId}
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DUR_QUICK }}
        className="tody-scroll"
        style={{ flex: 1, minHeight: 0 }}
      >
        {!searching && !isEmpty && activeCategory === 'overview' && !energyFilter && (
          <PlanningRitual onStartFocus={() => setFocusMode(true)} />
        )}
        {searching ? (
          query.trim() && searchResults.length === 0 ? (
            <EmptyState title="No matches" subtitle="Try a different search." icon="search-outline" />
          ) : (
            searchResults.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onPress={openTask}
                onComplete={onComplete}
                onDefer={setSnoozeId}
                onRevive={reviveTask}
                onStart={startTask}
                onCompleteTimed={completeTimedTask}
                onLongPress={setMenuTask}
                assignee={assigneeFor(t)}
              />
            ))
          )
        ) : isEmpty && energyFilter ? (
          <EmptyState
            title={energyFilter === 'high' ? 'Nothing needs deep focus right now' : energyFilter === 'low' ? 'No quick wins left here' : 'Nothing at this energy level'}
            subtitle="Try a different energy, or clear the filter."
            icon="flash-outline"
          />
        ) : tasks.length === 0 && activeCategory === 'overview' && !scratchStart ? (
          <ZeroStateOnboarding
            onSelectTemplate={(tpl) => {
              tpl.tasks.forEach((t) =>
                addTask(t.title, {
                  priority: t.priority,
                  energyLevel: t.energyLevel,
                  estimatedMinutes: t.estimatedMinutes,
                  workspaceId: workspaceIdForDb(activeWorkspaceId),
                }),
              );
            }}
            onScratch={() => setScratchStart(true)}
          />
        ) : isEmpty ? (
          <EmptyState
            title="Nothing here yet"
            subtitle="Add your first task below to get started."
            icon="checkmark-done-outline"
          />
        ) : sortOption !== 'default' ? (
          // Flat, explicitly-sorted list (no smart sections).
          sortTasks(visibleTasks, sortOption).map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onPress={openTask}
              onComplete={onComplete}
              onDefer={setSnoozeId}
              onRevive={reviveTask}
              onStart={startTask}
              onCompleteTimed={completeTimedTask}
              onLongPress={setMenuTask}
              isLocked={isTaskLocked(task, tasks)}
              assignee={assigneeFor(task)}
            />
          ))
        ) : (
          (() => {
            let rowIndex = 0; // running index across sections for first-load stagger
            return sections.map((section) => {
              const rows = buildTreeRows(flattenTasksHierarchically(section.data));
              return (
                <div key={section.key}>
                  <SectionHeader title={section.title} count={section.data.length} />
                  {section.key === 'now' && <TodayLine />}
                  {rows.map(({ task, isLastChild, ancestorContinuation }) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onPress={openTask}
                      onComplete={onComplete}
                      onDefer={setSnoozeId}
                      onRevive={reviveTask}
                      onStart={startTask}
                      onCompleteTimed={completeTimedTask}
                      onLongPress={setMenuTask}
                      isLocked={isTaskLocked(task, tasks)}
                      isLastChild={isLastChild}
                      ancestorContinuation={ancestorContinuation}
                      entranceDelay={entranceDelay(rowIndex++)}
                      assignee={assigneeFor(task)}
                    />
                  ))}
                </div>
              );
            });
          })()
        )}
        <div style={{ height: 8 }} />
      </motion.div>

      {/* Add task */}
      {!searching && (
        <div style={{ borderTop: '1px solid var(--c-border-light)', paddingBottom: 'var(--safe-bottom)' }}>
          <TaskInput
            onSubmit={handleAdd}
            defaultCategory={activeCategory !== 'overview' ? activeCategory : 'personal'}
            categories={assignableCats}
          />
        </div>
      )}

      {/* Long-press rich preview overlay */}
      <TaskPreviewOverlay
        task={menuTask}
        allTasks={tasks}
        onClose={() => setMenuTask(null)}
        onEdit={(t) => { openTask(t); setMenuTask(null); }}
        onAddSubtask={(t) => { setMenuTask(null); navigate(`/task/${t.id}`); }}
        onDelete={(t) => onDelete(t)}
        onSnooze={(t) => { setMenuTask(null); setSnoozeId(t.id); }}
        onAssign={isSharedWorkspace ? (t) => { setMenuTask(null); setAssignTaskId(t.id); } : undefined}
      />

      {/* Snooze menu (defer swipe + preview + detail) */}
      <SnoozeMenu
        open={snoozeId != null}
        onClose={() => setSnoozeId(null)}
        onSelect={(option) => { if (snoozeId) deferTask(snoozeId, option); }}
      />

      {/* Assign a shared-workspace task to a member */}
      <AssigneePicker
        open={assignTaskId != null}
        onClose={() => setAssignTaskId(null)}
        taskId={assignTaskId}
        currentAssigneeId={assignTaskId ? tasks.find((t) => t.id === assignTaskId)?.assigneeId : null}
      />

      {/* Add category prompt */}
      <PromptModal
        visible={addingCat}
        title="New category"
        submitLabel="Add"
        onCancel={() => setAddingCat(false)}
        onSubmit={(name) => {
          const trimmed = name.trim();
          if (trimmed) {
            const palette = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
            addCategory(trimmed, 'folder-outline', palette[categories.length % palette.length]);
          }
          setAddingCat(false);
        }}
      />

      {/* Sort dropdown */}
      <SortDropdown open={sortOpen} current={sortOption} onSelect={setSort} onClose={() => setSortOpen(false)} />

      {/* Manage categories */}
      <ManageCategoriesModal
        open={managingCats}
        categories={categories}
        onClose={() => setManagingCats(false)}
        onRename={(id, name) => updateCategory(id, { name })}
        onDelete={deleteCategory}
        onReorder={reorderCategories}
      />

      {/* Focus mode overlay */}
      <AnimatePresence>
        {focusMode && (
          <FocusMode
            tasks={focusTasks}
            allTasks={tasks}
            onComplete={onComplete}
            onExit={() => setFocusMode(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
