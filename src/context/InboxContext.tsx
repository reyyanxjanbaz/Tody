import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { Alert } from 'react-native';
import { InboxTask } from '../types';
import { saveInboxTasks, getInboxTasks } from '../utils/storage';
import { generateId } from '../utils/id';
import { useAuth } from './AuthContext';
import {
  fetchInboxTasks as fetchDbInbox,
  pushInboxTasks,
  upsertInboxTask,
  deleteInboxTaskFromDb,
} from '../lib/supabaseSync';

const MAX_INBOX_ITEMS = 100;
const WARNING_THRESHOLD = 90;

interface InboxContextType {
  inboxTasks: InboxTask[];
  inboxCount: number;
  isLoading: boolean;
  captureTask: (rawText: string) => InboxTask | null;
  deleteInboxTask: (id: string) => void;
  getInboxTask: (id: string) => InboxTask | undefined;
  removeInboxTask: (id: string) => void;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [inboxTasks, setInboxTasks] = useState<InboxTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tasksRef = useRef(inboxTasks);
  tasksRef.current = inboxTasks;
  const hasSyncedRef = useRef(false);

  const persistTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from disk on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await getInboxTasks<InboxTask>();
        setInboxTasks(stored);
      } catch {
        // Start fresh
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Supabase sync on login
  useEffect(() => {
    if (!user || isLoading || hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    (async () => {
      try {
        // Fetch from DB
        const dbItems = await fetchDbInbox();

        // Merge: DB wins on conflicts
        if (dbItems.length > 0) {
          setInboxTasks(prev => {
            const merged = new Map<string, InboxTask>();
            for (const t of prev) merged.set(t.id, t);
            for (const t of dbItems) {
              if (!merged.has(t.id) || t.capturedAt > (merged.get(t.id)?.capturedAt || 0)) {
                merged.set(t.id, t);
              }
            }
            return Array.from(merged.values());
          });
        }

        // Push local-only items to Supabase
        const localItems = tasksRef.current;
        if (localItems.length > 0) {
          await pushInboxTasks(localItems, user.id);
        }

        console.log('[InboxContext] Supabase sync complete');
      } catch (e) {
        console.error('[InboxContext] Supabase sync error:', e);
      }
    })();
  }, [user, isLoading]);

  // Persist with debounce
  useEffect(() => {
    if (isLoading) return;

    if (persistTimeout.current) {
      clearTimeout(persistTimeout.current);
    }
    persistTimeout.current = setTimeout(() => {
      saveInboxTasks(inboxTasks);
    }, 300);

    return () => {
      if (persistTimeout.current) {
        clearTimeout(persistTimeout.current);
      }
    };
  }, [inboxTasks, isLoading]);

  const captureTask = useCallback((rawText: string): InboxTask | null => {
    const currentCount = tasksRef.current.length;

    if (currentCount >= MAX_INBOX_ITEMS) {
      Alert.alert(
        'Inbox Full',
        'You have 100 inbox items. Process some before adding more.',
      );
      return null;
    }

    if (currentCount >= WARNING_THRESHOLD) {
      Alert.alert(
        'Inbox Almost Full',
        `You have ${currentCount} of ${MAX_INBOX_ITEMS} inbox items. Consider processing some soon.`,
      );
    }

    const task: InboxTask = {
      id: generateId(),
      rawText,
      capturedAt: Date.now(),
    };

    setInboxTasks(prev => [task, ...prev]);

    // Sync to Supabase
    if (user) {
      upsertInboxTask(task, user.id).catch(() => {});
    }

    return task;
  }, [user]);

  const removeInboxTask = useCallback((id: string) => {
    setInboxTasks(prev => prev.filter(t => t.id !== id));
    // Delete from Supabase
    if (user) {
      deleteInboxTaskFromDb(id).catch(() => {});
    }
  }, [user]);

  const deleteInboxTask = removeInboxTask;

  const getInboxTask = useCallback((id: string): InboxTask | undefined => {
    return tasksRef.current.find(t => t.id === id);
  }, []);

  const inboxCount = inboxTasks.length;

  return (
    <InboxContext.Provider
      value={{
        inboxTasks,
        inboxCount,
        isLoading,
        captureTask,
        deleteInboxTask,
        getInboxTask,
        removeInboxTask,
      }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox(): InboxContextType {
  const ctx = useContext(InboxContext);
  if (!ctx) {
    throw new Error('useInbox must be used within InboxProvider');
  }
  return ctx;
}
