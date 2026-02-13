import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { Task, Priority } from '../types';
import { saveTasks, getTasks } from '../utils/storage';
import { generateId } from '../utils/id';
import { parseTaskInput } from '../utils/taskParser';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Context shape ────────────────────────────────────────────────────────────

interface TaskContextType {
  tasks: Task[];
  isLoading: boolean;
  addTask: (input: string, overrides?: Partial<Task>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  deferTask: (id: string) => void;
  deleteTask: (id: string) => void;
  getTask: (id: string) => Task | undefined;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Debounced persist
  const persistTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from disk on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await getTasks<Task>();
        setTasks(stored);
      } catch {
        // Start fresh if storage is corrupt
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Persist with 300ms debounce on every change
  useEffect(() => {
    if (isLoading) { return; }

    if (persistTimeout.current) {
      clearTimeout(persistTimeout.current);
    }
    persistTimeout.current = setTimeout(() => {
      saveTasks(tasks);
    }, 300);

    return () => {
      if (persistTimeout.current) {
        clearTimeout(persistTimeout.current);
      }
    };
  }, [tasks, isLoading]);

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
      isCompleted: false,
      isRecurring: false,
      recurringFrequency: null,
      deferCount: 0,
      createdHour: new Date().getHours(),
      ...overrides,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => [task, ...prev]);
    return task;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t,
      ),
    );
  }, []);

  const completeTask = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, isCompleted: true, completedAt: Date.now(), updatedAt: Date.now() }
          : t,
      ),
    );
  }, []);

  const uncompleteTask = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, isCompleted: false, completedAt: null, updatedAt: Date.now() }
          : t,
      ),
    );
  }, []);

  const deferTask = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              deadline: tomorrow.getTime(),
              deferCount: t.deferCount + 1,
              updatedAt: Date.now(),
            }
          : t,
      ),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTask = useCallback((id: string): Task | undefined => {
    return tasksRef.current.find(t => t.id === id);
  }, []);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        isLoading,
        addTask,
        updateTask,
        completeTask,
        uncompleteTask,
        deferTask,
        deleteTask,
        getTask,
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
