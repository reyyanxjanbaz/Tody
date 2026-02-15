export type Priority = 'high' | 'medium' | 'low' | 'none';

export type EnergyLevel = 'high' | 'medium' | 'low';

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
  energyLevel: EnergyLevel; // Required: 'high' | 'medium' | 'low'
  isCompleted: boolean;
  isRecurring: boolean;
  recurringFrequency: RecurringFrequency | null;
  deferCount: number;
  createdHour: number; // 0-23, for time-of-day intelligence
  overdueStartDate?: number | null; // When task first became overdue (timestamp)
  revivedAt?: number | null; // When user revived the task (timestamp)
  archivedAt?: number | null; // When task was archived (timestamp)
  isArchived?: boolean; // Whether task is in the overdue archive
  // Time Block Integrity fields
  estimatedMinutes?: number | null; // User's estimate
  actualMinutes?: number | null; // Calculated on completion
  startedAt?: number | null; // Timestamp when user marks task as "started"
  // Dependency Chains fields
  parentId?: string | null; // null for root tasks
  childIds: string[]; // Array of child task IDs
  depth: number; // 0 = root, 1 = first level subtask, 2 = second level, 3 = max

  // Category
  category?: string; // Category ID (e.g., 'work', 'personal', 'health')

  // User
  userId?: string; // Owner of this task
}

export interface TaskPattern {
  keywords: string[]; // Extracted from similar task titles
  averageActualMinutes: number;
  sampleSize: number; // How many tasks in this pattern
  accuracyScore: number; // How close estimates are to reality (0-100)
}

export interface UserStats {
  totalCompletedTasks: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  realityScore: number; // Overall accuracy percentage
  underestimationRate: number; // How much user typically underestimates (as percentage)
}

export interface User {
  id: string;
  email: string;
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

export interface InboxTask {
  id: string;
  rawText: string;
  capturedAt: number;
  isProcessing?: boolean;
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Archive: undefined;
  TaskDetail: { taskId: string };
  ProcessInbox: undefined;
  RealityScore: undefined;
  Profile: undefined;
  Settings: undefined;
};

// ── Profile & Settings Types ───────────────────────────────────────────────

export interface UserPreferences {
  darkMode: boolean;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  weekStartsOn: 'sunday' | 'monday';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  darkMode: true,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  weekStartsOn: 'sunday',
};

export interface ProfileStats {
  totalCreated: number;
  totalCompleted: number;
  totalIncomplete: number;
  completionPercentage: number;
  currentStreak: number;
  bestStreak: number;
  averageTasksPerDay: number;
  totalMinutesSpent: number;
  averageMinutesPerTask: number;
  mostProductiveDay: string;
}

export interface DayTaskStatus {
  date: number; // timestamp start of day
  total: number;
  completed: number;
  allDone: boolean; // total > 0 && completed === total
  hasIncomplete: boolean; // total > completed
}

export interface XPData {
  totalXP: number;
  level: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
}

// ── Category System ──────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;       // Ionicons name
  color: string;      // Hex accent color
  isDefault: boolean; // Overview can't be deleted
  order: number;
}

export type SortOption = 'default' | 'smart' | 'deadline-asc' | 'deadline-desc' | 'priority-high' | 'priority-low' | 'newest' | 'oldest';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'overview', name: 'Overview', icon: 'grid-outline', color: '#000000', isDefault: true, order: 0 },
  { id: 'work', name: 'Work', icon: 'briefcase-outline', color: '#3B82F6', isDefault: false, order: 1 },
  { id: 'personal', name: 'Personal', icon: 'person-outline', color: '#8B5CF6', isDefault: false, order: 2 },
  { id: 'health', name: 'Health', icon: 'heart-outline', color: '#10B981', isDefault: false, order: 3 },
];
