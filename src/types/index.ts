export type Priority = 'high' | 'medium' | 'low' | 'none';

export type Section = 'overdue' | 'now' | 'next' | 'later' | 'someday';

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface Task {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  deadline: number | null;
  completedAt: number | null;
  priority: Priority;
  isCompleted: boolean;
  isRecurring: boolean;
  recurringFrequency: RecurringFrequency | null;
  deferCount: number;
  createdHour: number; // 0-23, for time-of-day intelligence
}

export interface User {
  id: string;
  email: string;
  token: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface TaskSectionData {
  key: Section;
  title: string;
  data: Task[];
}

export interface ParsedTaskInput {
  title: string;
  deadline: number | null;
  priority: Priority;
}

export type EnergyLevel = 'high' | 'medium' | 'low';

export interface InboxTask {
  id: string;
  rawText: string;
  capturedAt: number;
  isProcessing?: boolean;
}

export interface ProcessedTask extends InboxTask {
  title: string;
  description?: string;
  deadline?: number | null;
  priority: Priority;
  energyLevel: EnergyLevel;
  processedAt: number;
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Archive: undefined;
  TaskDetail: { taskId: string };
  ProcessInbox: undefined;
};
