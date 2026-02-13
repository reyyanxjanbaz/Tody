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
  const [inboxTasks, setInboxTasks] = useState<InboxTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tasksRef = useRef(inboxTasks);
  tasksRef.current = inboxTasks;

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
    return task;
  }, []);

  const deleteInboxTask = useCallback((id: string) => {
    setInboxTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const removeInboxTask = useCallback((id: string) => {
    setInboxTasks(prev => prev.filter(t => t.id !== id));
  }, []);

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
