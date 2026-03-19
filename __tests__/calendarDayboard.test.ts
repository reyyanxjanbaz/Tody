import { getDayboardData, getWeekDays } from '../src/utils/calendarDayboard';
import { Task } from '../src/types';

function makeTask(overrides: Partial<Task>): Task {
  const baseTime = new Date(2026, 2, 20, 9, 0, 0, 0).getTime();

  return {
    id: overrides.id ?? `task-${Math.random()}`,
    title: overrides.title ?? 'Task',
    description: overrides.description ?? '',
    createdAt: overrides.createdAt ?? baseTime,
    updatedAt: overrides.updatedAt ?? baseTime,
    deadline: overrides.deadline ?? null,
    scheduledStartAt: overrides.scheduledStartAt ?? null,
    scheduledEndAt: overrides.scheduledEndAt ?? null,
    completedAt: overrides.completedAt ?? null,
    priority: overrides.priority ?? 'none',
    energyLevel: overrides.energyLevel ?? 'medium',
    isCompleted: overrides.isCompleted ?? false,
    isRecurring: overrides.isRecurring ?? false,
    recurringFrequency: overrides.recurringFrequency ?? null,
    deferCount: overrides.deferCount ?? 0,
    createdHour: overrides.createdHour ?? 9,
    overdueStartDate: overrides.overdueStartDate ?? null,
    revivedAt: overrides.revivedAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    isArchived: overrides.isArchived ?? false,
    estimatedMinutes: overrides.estimatedMinutes ?? null,
    actualMinutes: overrides.actualMinutes ?? null,
    startedAt: overrides.startedAt ?? null,
    parentId: overrides.parentId ?? null,
    childIds: overrides.childIds ?? [],
    depth: overrides.depth ?? 0,
    category: overrides.category ?? 'personal',
    userId: overrides.userId ?? 'user-1',
  };
}

describe('calendarDayboard', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 20, 10, 0, 0, 0));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('splits tasks into committed, due today, flexible, and renegotiation', () => {
    const selectedDate = new Date(2026, 2, 20, 0, 0, 0, 0).getTime();
    const overdueDeadline = new Date(2026, 2, 18, 18, 0, 0, 0).getTime();

    const tasks: Task[] = [
      makeTask({
        id: 'scheduled',
        title: 'Deep work',
        scheduledStartAt: new Date(2026, 2, 20, 11, 0, 0, 0).getTime(),
        scheduledEndAt: new Date(2026, 2, 20, 12, 0, 0, 0).getTime(),
        estimatedMinutes: 60,
      }),
      makeTask({
        id: 'timed-deadline',
        title: 'Call supplier',
        deadline: new Date(2026, 2, 20, 15, 30, 0, 0).getTime(),
        estimatedMinutes: 30,
        priority: 'high',
      }),
      makeTask({
        id: 'due-today',
        title: 'Send recap',
        deadline: new Date(2026, 2, 20, 23, 59, 0, 0).getTime(),
      }),
      makeTask({
        id: 'flexible',
        title: 'Outline next sprint',
        estimatedMinutes: 45,
      }),
      makeTask({
        id: 'overdue',
        title: 'Fix the bug',
        deadline: overdueDeadline,
        overdueStartDate: overdueDeadline,
      }),
    ];

    const result = getDayboardData(tasks, selectedDate, 'overview');

    expect(result.committed.map(item => item.task.id)).toEqual(['scheduled', 'timed-deadline']);
    expect(result.dueToday.map(task => task.id)).toEqual(['due-today']);
    expect(result.flexible.map(task => task.id)).toEqual(['flexible']);
    expect(result.renegotiation.map(task => task.id)).toEqual(['overdue']);
    expect(result.statusText).toContain('gentle reset');
  });

  it('filters by category while keeping overview inclusive', () => {
    const selectedDate = new Date(2026, 2, 20, 0, 0, 0, 0).getTime();
    const tasks: Task[] = [
      makeTask({ id: 'work-1', category: 'work', title: 'Review roadmap' }),
      makeTask({ id: 'personal-1', category: 'personal', title: 'Stretch' }),
    ];

    const workResult = getDayboardData(tasks, selectedDate, 'work');
    const overviewResult = getDayboardData(tasks, selectedDate, 'overview');

    expect(workResult.flexible.map(task => task.id)).toEqual(['work-1']);
    expect(overviewResult.flexible.map(task => task.id)).toEqual(['work-1', 'personal-1']);
  });

  it('builds week strips using the preferred week start', () => {
    const anchor = new Date(2026, 2, 20, 0, 0, 0, 0).getTime();

    const sundayWeek = getWeekDays(anchor, 'sunday');
    const mondayWeek = getWeekDays(anchor, 'monday');

    expect(sundayWeek[0].getDay()).toBe(0);
    expect(mondayWeek[0].getDay()).toBe(1);
  });
});
