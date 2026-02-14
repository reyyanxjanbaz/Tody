import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { Task, Category, DEFAULT_CATEGORIES } from '../types';
import {
  saveTasks, getTasks, saveArchivedTasks, getArchivedTasks,
  saveCategories, getCategories, saveActiveCategory, getActiveCategory,
} from '../utils/storage';
import { generateId } from '../utils/id';
import { useAuth } from './AuthContext';
import { parseTaskInput } from '../utils/taskParser';
import { initializeOverdueDates, isFullyDecayed } from '../utils/decay';
import { calculateActualMinutes, isTooShort } from '../utils/timeTracking';
import { updatePatternsOnCompletion } from '../utils/patternLearning';
import { getAllDescendantIds } from '../utils/dependencyChains';
import {
  fetchCategories as fetchDbCategories,
  fetchTasks as fetchDbTasks,
  pushTasks,
  pushCategories,
  upsertTask,
  upsertCategory,
  deleteTaskFromDb,
  deleteTasksFromDb,
  buildCategoryMap,
  CategoryMap,
} from '../lib/supabaseSync';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Context shape ────────────────────────────────────────────────────────────

interface TaskContextType {
  tasks: Task[];
  archivedTasks: Task[];
  isLoading: boolean;
  // Category system
  categories: Category[];
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  addCategory: (name: string, icon: string, color: string) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (orderedIds: string[]) => void;
  // Task operations
  addTask: (input: string, overrides?: Partial<Task>) => Task;
  addSubtask: (parentId: string, input: string, overrides?: Partial<Task>) => Task | null;
  updateTask: (id: string, updates: Partial<Task>) => void;
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  deferTask: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteTaskWithCascade: (id: string) => void;
  getTask: (id: string) => Task | undefined;
  reviveTask: (id: string) => void;
  archiveOverdueTasks: () => void;
  getFullyDecayedTasks: () => Task[];
  startTask: (id: string) => void;
  completeTimedTask: (id: string, adjustedMinutes?: number) => void;
  moveTaskToParent: (taskId: string, newParentId: string | null) => void;
  restoreTasks: (snapshots: Task[]) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

// ── Merge helper — combines local and DB task lists ─────────────────────────

function mergeTaskLists(local: Task[], remote: Task[]): Task[] {
  const merged = new Map<string, Task>();
  // Start with local tasks
  for (const t of local) {
    merged.set(t.id, t);
  }
  // Remote wins if its updatedAt is newer
  for (const t of remote) {
    const existing = merged.get(t.id);
    if (!existing || t.updatedAt > existing.updatedAt) {
      merged.set(t.id, t);
    }
  }
  return Array.from(merged.values());
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState<string>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const catMapRef = useRef<CategoryMap>({ toUUID: {}, toLocal: {} });
  const hasSyncedRef = useRef(false);

  // Debounced persist
  const persistTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from disk on mount, then sync with Supabase
  useEffect(() => {
    (async () => {
      try {
        const stored = await getTasks<Task>();
        // Migrate: ensure dependency chain fields exist and energyLevel is present
        const migrated = stored.map(t => ({
          ...t,
          childIds: t.childIds ?? [],
          depth: t.depth ?? 0,
          parentId: t.parentId ?? null,
          energyLevel: t.energyLevel ?? 'medium',
          category: t.category ?? 'personal',
        }));
        // Initialize overdueStartDate for tasks that became overdue
        const initialized = initializeOverdueDates(migrated);
        setTasks(initialized);

        const storedArchived = await getArchivedTasks<Task>();
        setArchivedTasks(storedArchived);

        // Load categories
        const storedCategories = await getCategories<Category>();
        if (storedCategories.length > 0) {
          setCategories(storedCategories);
        }
        const storedActiveCategory = await getActiveCategory();
        if (storedActiveCategory) {
          setActiveCategory(storedActiveCategory);
        }
      } catch {
        // Start fresh if storage is corrupt
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Supabase sync: push local data on login / pull on subsequent launches ─
  useEffect(() => {
    if (!user || isLoading || hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    (async () => {
      try {
        // 1. Push local categories to Supabase
        await pushCategories(categories, user.id);

        // 2. Build category map
        const dbCats = await fetchDbCategories();
        const localCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
        catMapRef.current = buildCategoryMap(localCats, dbCats as any);

        // 3. Fetch existing tasks from DB
        const { active: dbActive, archived: dbArchived } = await fetchDbTasks(catMapRef.current);

        // 4. Merge: if DB has tasks, merge with local (DB wins on conflicts by updatedAt)
        if (dbActive.length > 0 || dbArchived.length > 0) {
          setTasks(prev => mergeTaskLists(prev, dbActive));
          setArchivedTasks(prev => mergeTaskLists(prev, dbArchived));
        }

        // 5. Push any local-only tasks to Supabase
        const allLocal = [...tasksRef.current, ...archivedTasks];
        if (allLocal.length > 0) {
          await pushTasks(allLocal, user.id, catMapRef.current);
        }

        console.log('[TaskContext] Supabase sync complete');
      } catch (e) {
        console.error('[TaskContext] Supabase sync error:', e);
      }
    })();
  }, [user, isLoading]);

  // Persist with 300ms debounce on every change
  useEffect(() => {
    if (isLoading) { return; }

    if (persistTimeout.current) {
      clearTimeout(persistTimeout.current);
    }
    persistTimeout.current = setTimeout(() => {
      saveTasks(tasks);
    }, 500);

    return () => {
      if (persistTimeout.current) {
        clearTimeout(persistTimeout.current);
      }
    };
  }, [tasks, isLoading]);

  // Persist archived tasks
  const archivePersistTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isLoading) { return; }

    if (archivePersistTimeout.current) {
      clearTimeout(archivePersistTimeout.current);
    }
    archivePersistTimeout.current = setTimeout(() => {
      saveArchivedTasks(archivedTasks);
    }, 500);

    return () => {
      if (archivePersistTimeout.current) {
        clearTimeout(archivePersistTimeout.current);
      }
    };
  }, [archivedTasks, isLoading]);

  // Persist category preferences
  useEffect(() => {
    if (!isLoading) {
      saveCategories(categories);
    }
  }, [categories, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveActiveCategory(activeCategory);
    }
  }, [activeCategory, isLoading]);

  const addTask = useCallback((input: string, overrides?: Partial<Task>): Task => {
    const parsed = parseTaskInput(input);
    const now = Date.now();

    const task: Task = {
      id: generateId(),
      title: parsed.title,
      description: '',
      createdAt: now,
      updatedAt: now,
      deadline: parsed.deadline,
      completedAt: null,
      priority: parsed.priority,
      energyLevel: 'medium',
      category: 'personal',
      isCompleted: false,
      isRecurring: false,
      recurringFrequency: null,
      deferCount: 0,
      createdHour: new Date().getHours(),
      overdueStartDate: null,
      revivedAt: null,
      archivedAt: null,
      isArchived: false,
      estimatedMinutes: null,
      actualMinutes: null,
      startedAt: null,
      parentId: null,
      childIds: [],
      depth: 0,
      userId: user?.id,
      ...overrides,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => [task, ...prev]);

    // Sync to Supabase (fire-and-forget)
    if (user) {
      upsertTask(task, user.id, catMapRef.current).catch(() => {});
    }

    return task;
  }, [user]);

  const addSubtask = useCallback((parentId: string, input: string, overrides?: Partial<Task>): Task | null => {
    const parent = tasksRef.current.find(t => t.id === parentId);
    if (!parent || parent.depth >= 3) return null;

    const parsed = parseTaskInput(input);
    const now = Date.now();

    const subtask: Task = {
      id: generateId(),
      title: parsed.title,
      description: '',
      createdAt: now,
      updatedAt: now,
      deadline: parsed.deadline,
      completedAt: null,
      priority: parsed.priority,
      energyLevel: parent.energyLevel ?? 'medium', // Inherit parent's energy level
      category: parent.category || 'personal', // Inherit parent's category
      isCompleted: false,
      isRecurring: false,
      recurringFrequency: null,
      deferCount: 0,
      createdHour: new Date().getHours(),
      overdueStartDate: null,
      revivedAt: null,
      archivedAt: null,
      isArchived: false,
      estimatedMinutes: null,
      actualMinutes: null,
      startedAt: null,
      parentId,
      childIds: [],
      depth: parent.depth + 1,
      userId: user?.id,
      ...overrides,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => {
      const updated = prev.map(t =>
        t.id === parentId
          ? { ...t, childIds: [...t.childIds, subtask.id], updatedAt: now }
          : t,
      );
      // Insert subtask right after parent in the list
      const parentIndex = updated.findIndex(t => t.id === parentId);
      const insertIndex = parentIndex >= 0 ? parentIndex + 1 : 0;
      updated.splice(insertIndex, 0, subtask);
      return updated;
    });

    // Sync subtask + updated parent to Supabase
    // Upsert parent first so the FK constraint on parent_id is satisfied
    if (user) {
      const parentTask = tasksRef.current.find(t => t.id === parentId);
      if (parentTask) {
        upsertTask({ ...parentTask, childIds: [...parentTask.childIds, subtask.id], updatedAt: now }, user.id, catMapRef.current)
          .then(() => upsertTask(subtask, user.id, catMapRef.current))
          .catch(() => {});
      } else {
        upsertTask(subtask, user.id, catMapRef.current, tasksRef.current).catch(() => {});
      }
    }

    return subtask;
  }, [user]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) { return t; }
        const merged = { ...t, ...updates, updatedAt: Date.now() };
        // If deadline changed, recalculate overdue tracking
        if (updates.deadline !== undefined && updates.deadline !== t.deadline) {
          merged.overdueStartDate = null;
        }
        // Sync to Supabase
        if (user) {
          upsertTask(merged, user.id, catMapRef.current, prev).catch(() => {});
        }
        return merged;
      }),
    );
  }, [user]);

  const completeTask = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const now = Date.now();
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) { return t; }
        const actualMins = t.startedAt
          ? calculateActualMinutes(t.startedAt, now)
          : null;
        return {
          ...t,
          isCompleted: true,
          completedAt: now,
          updatedAt: now,
          actualMinutes: actualMins,
        };
      });

      // Sync completed task to Supabase
      const completedTask = updated.find(t => t.id === id);
      if (completedTask && user) {
        upsertTask(completedTask, user.id, catMapRef.current, updated).catch(() => {});
      }

      // Run pattern learning in background
      if (completedTask?.actualMinutes && !isTooShort(completedTask.actualMinutes)) {
        const allCompleted = updated.filter(t => t.isCompleted && t.actualMinutes && t.actualMinutes >= 1);
        updatePatternsOnCompletion(completedTask, allCompleted).catch(() => { });
      }

      return updated;
    });
  }, [user]);

  const startTask = useCallback((id: string) => {
    const now = Date.now();
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, startedAt: now, updatedAt: now };
        if (user) upsertTask(updated, user.id, catMapRef.current, prev).catch(() => {});
        return updated;
      }),
    );
  }, [user]);

  const completeTimedTask = useCallback((id: string, adjustedMinutes?: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const now = Date.now();
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) { return t; }
        const calcMins = t.startedAt
          ? calculateActualMinutes(t.startedAt, now)
          : null;
        const actualMins = adjustedMinutes != null ? adjustedMinutes : calcMins;
        return {
          ...t,
          isCompleted: true,
          completedAt: now,
          updatedAt: now,
          actualMinutes: actualMins,
        };
      });

      const completedTask = updated.find(t => t.id === id);
      if (completedTask && user) {
        upsertTask(completedTask, user.id, catMapRef.current, updated).catch(() => {});
      }
      if (completedTask?.actualMinutes && !isTooShort(completedTask.actualMinutes)) {
        const allCompleted = updated.filter(t => t.isCompleted && t.actualMinutes && t.actualMinutes >= 1);
        updatePatternsOnCompletion(completedTask, allCompleted).catch(() => { });
      }

      return updated;
    });
  }, [user]);

  const uncompleteTask = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const now = Date.now();
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, isCompleted: false, completedAt: null, updatedAt: now };
        if (user) upsertTask(updated, user.id, catMapRef.current, prev).catch(() => {});
        return updated;
      }),
    );
  }, [user]);

  const deferTask = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    const now = Date.now();

    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = {
          ...t,
          deadline: tomorrow.getTime(),
          deferCount: t.deferCount + 1,
          overdueStartDate: null,
          updatedAt: now,
        };
        if (user) upsertTask(updated, user.id, catMapRef.current, prev).catch(() => {});
        return updated;
      }),
    );
  }, [user]);

  const deleteTask = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;
      // Remove from parent's childIds
      let updated = prev;
      if (task.parentId) {
        updated = updated.map(t =>
          t.id === task.parentId
            ? { ...t, childIds: t.childIds.filter(cid => cid !== id), updatedAt: Date.now() }
            : t,
        );
        // Sync parent update
        if (user) {
          const parent = updated.find(t => t.id === task.parentId);
          if (parent) upsertTask(parent, user.id, catMapRef.current).catch(() => {});
        }
      }
      // Delete from Supabase
      if (user) deleteTaskFromDb(id).catch(() => {});
      return updated.filter(t => t.id !== id);
    });
  }, [user]);

  const deleteTaskWithCascade = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;
      const descendantIds = getAllDescendantIds(id, prev);
      const idsToRemove = new Set([id, ...descendantIds]);
      // Remove from parent's childIds
      let updated = prev;
      if (task.parentId) {
        updated = updated.map(t =>
          t.id === task.parentId
            ? { ...t, childIds: t.childIds.filter(cid => cid !== id), updatedAt: Date.now() }
            : t,
        );
        if (user) {
          const parent = updated.find(t => t.id === task.parentId);
          if (parent) upsertTask(parent, user.id, catMapRef.current).catch(() => {});
        }
      }
      // Delete all from Supabase
      if (user) deleteTasksFromDb(Array.from(idsToRemove)).catch(() => {});
      return updated.filter(t => !idsToRemove.has(t.id));
    });
  }, [user]);

  // Restore previously deleted/completed tasks from snapshots (for Undo)
  const restoreTasks = useCallback((snapshots: Task[]) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const toRestore = snapshots.filter(s => !existingIds.has(s.id));
      let updated = [...prev, ...toRestore];
      // Re-attach children to parents
      for (const restored of toRestore) {
        if (restored.parentId) {
          updated = updated.map(t =>
            t.id === restored.parentId && !t.childIds.includes(restored.id)
              ? { ...t, childIds: [...t.childIds, restored.id], updatedAt: Date.now() }
              : t,
          );
        }
      }

      // Sync restored tasks to Supabase
      if (user) {
        for (const restored of toRestore) {
          upsertTask(restored, user.id, catMapRef.current, updated).catch(() => {});
        }
      }

      return updated;
    });
  }, [user]);

  const moveTaskToParent = useCallback((taskId: string, newParentId: string | null) => {
    const now = Date.now();
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      let updated = [...prev];

      // Remove from old parent's childIds
      if (task.parentId) {
        updated = updated.map(t =>
          t.id === task.parentId
            ? { ...t, childIds: t.childIds.filter(cid => cid !== taskId), updatedAt: now }
            : t,
        );
      }

      if (newParentId) {
        const newParent = updated.find(t => t.id === newParentId);
        if (!newParent || newParent.depth >= 3) return prev;

        const depthDiff = (newParent.depth + 1) - task.depth;

        // Update new parent's childIds
        updated = updated.map(t => {
          if (t.id === newParentId) {
            return { ...t, childIds: [...t.childIds, taskId], updatedAt: now };
          }
          return t;
        });

        // Update the task and all descendants' depths
        const descendantIds = getAllDescendantIds(taskId, updated);
        updated = updated.map(t => {
          if (t.id === taskId) {
            return { ...t, parentId: newParentId, depth: newParent.depth + 1, updatedAt: now };
          }
          if (descendantIds.includes(t.id)) {
            return { ...t, depth: t.depth + depthDiff, updatedAt: now };
          }
          return t;
        });
      } else {
        // Moving to root
        const depthDiff = -task.depth;
        const descendantIds = getAllDescendantIds(taskId, updated);
        updated = updated.map(t => {
          if (t.id === taskId) {
            return { ...t, parentId: null, depth: 0, updatedAt: now };
          }
          if (descendantIds.includes(t.id)) {
            return { ...t, depth: t.depth + depthDiff, updatedAt: now };
          }
          return t;
        });
      }

      // Sync all affected tasks to Supabase
      if (user) {
        const affectedIds = new Set([taskId]);
        if (task.parentId) affectedIds.add(task.parentId);
        if (newParentId) affectedIds.add(newParentId);
        const descendantIds = getAllDescendantIds(taskId, updated);
        descendantIds.forEach(did => affectedIds.add(did));
        for (const aid of affectedIds) {
          const t = updated.find(x => x.id === aid);
          if (t) upsertTask(t, user.id, catMapRef.current, updated).catch(() => {});
        }
      }

      return updated;
    });
  }, [user]);

  const reviveTask = useCallback((id: string) => {
    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = {
          ...t,
          overdueStartDate: null,
          revivedAt: now,
          deadline: todayEnd.getTime(),
          updatedAt: now,
        };
        if (user) upsertTask(updated, user.id, catMapRef.current, prev).catch(() => {});
        return updated;
      }),
    );
  }, [user]);

  const getFullyDecayedTasks = useCallback((): Task[] => {
    return tasksRef.current.filter(t => isFullyDecayed(t));
  }, []);

  const archiveOverdueTasks = useCallback(() => {
    const now = Date.now();
    const toArchive = tasksRef.current.filter(t => isFullyDecayed(t));

    if (toArchive.length === 0) { return; }

    const archivedItems = toArchive.map(t => ({
      ...t,
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    }));

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => prev.filter(t => !isFullyDecayed(t)));
    setArchivedTasks(prev => [...archivedItems, ...prev]);

    // Sync archived tasks to Supabase
    if (user) {
      for (const t of archivedItems) {
        upsertTask(t, user.id, catMapRef.current, tasksRef.current).catch(() => {});
      }
    }
  }, [user]);

  const getTask = useCallback((id: string): Task | undefined => {
    return tasksRef.current.find(t => t.id === id);
  }, []);

  // ── Category CRUD ────────────────────────────────────────────────────

  const addCategory = useCallback((name: string, icon: string, color: string): Category => {
    const newCat: Category = {
      id: generateId(),
      name,
      icon,
      color,
      isDefault: false,
      order: categories.length,
    };
    setCategories(prev => [...prev, newCat]);
    // Sync to Supabase
    if (user) {
      upsertCategory(newCat, user.id).catch(() => {});
    }
    return newCat;
  }, [categories.length, user]);

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setCategories(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      const cat = updated.find(c => c.id === id);
      if (cat && user) {
        upsertCategory(cat, user.id).catch(() => {});
      }
      return updated;
    });
  }, [user]);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    // Reassign tasks from deleted category to 'personal'
    setTasks(prev => prev.map(t =>
      t.category === id ? { ...t, category: 'personal', updatedAt: Date.now() } : t,
    ));
    // If the active tab was the deleted category, go to overview
    setActiveCategory(prev => prev === id ? 'overview' : prev);
  }, []);

  const reorderCategories = useCallback((orderedIds: string[]) => {
    setCategories(prev => {
      const map = new Map(prev.map(c => [c.id, c]));
      return orderedIds.map((id, i) => {
        const cat = map.get(id);
        return cat ? { ...cat, order: i } : cat;
      }).filter(Boolean) as Category[];
    });
  }, []);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        archivedTasks,
        categories,
        activeCategory,
        setActiveCategory,
        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,
        isLoading,
        addTask,
        addSubtask,
        updateTask,
        completeTask,
        uncompleteTask,
        deferTask,
        deleteTask,
        deleteTaskWithCascade,
        getTask,
        reviveTask,
        archiveOverdueTasks,
        getFullyDecayedTasks,
        startTask,
        completeTimedTask,
        moveTaskToParent,
        restoreTasks,
      }}>
      {children}
    </TaskContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTasks(): TaskContextType {
  const ctx = useContext(TaskContext);
  if (!ctx) { throw new Error('useTasks must be used within TaskProvider'); }
  return ctx;
}
