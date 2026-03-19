import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { CalendarScreen } from '../src/screens/CalendarScreen';
import { Task } from '../src/types';

function makeTask(overrides: Partial<Task>): Task {
  const baseTime = new Date(2026, 2, 20, 9, 0, 0, 0).getTime();

  return {
    id: overrides.id ?? 'task',
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

const mockTasks = [
  makeTask({
    id: 'scheduled',
    title: 'Deep work',
    scheduledStartAt: new Date(2026, 2, 20, 10, 0, 0, 0).getTime(),
    scheduledEndAt: new Date(2026, 2, 20, 11, 0, 0, 0).getTime(),
    estimatedMinutes: 60,
  }),
  makeTask({
    id: 'due',
    title: 'Send recap',
    deadline: new Date(2026, 2, 20, 23, 59, 0, 0).getTime(),
  }),
  makeTask({
    id: 'flex',
    title: 'Outline sprint',
    estimatedMinutes: 45,
  }),
];

const mockTaskContext = {
  tasks: mockTasks,
  categories: [
    { id: 'overview', name: 'Overview', icon: 'grid-outline', color: '#000000', isDefault: true, order: 0 },
    { id: 'personal', name: 'Personal', icon: 'person-outline', color: '#8B5CF6', isDefault: false, order: 1 },
  ],
  activeCategory: 'overview',
  updateTask: jest.fn(),
  completeTask: jest.fn(),
  completeTimedTask: jest.fn(),
  deferTask: jest.fn(),
  reviveTask: jest.fn(),
  startTask: jest.fn(),
  archiveTask: jest.fn(),
};

jest.mock('../src/context/TaskContext', () => ({
  useTasks: () => mockTaskContext,
}));

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      black: '#000000',
      white: '#FFFFFF',
      gray50: '#141414',
      gray100: '#1C1C1C',
      gray200: '#333333',
      gray400: '#7A7A7A',
      gray500: '#9A9A9A',
      gray600: '#B0B0B0',
      gray800: '#D4D4D4',
      background: '#000000',
      surface: '#141414',
      text: '#F0F0F0',
      textSecondary: '#B8B8B8',
      textTertiary: '#8A8A8A',
      border: '#2A2A2A',
      borderLight: '#1A1A1A',
      activeState: '#D4D4D4',
      danger: '#D4D4D4',
      surfaceDark: '#0A0A0A',
      surfaceGlass: 'rgba(255,255,255,0.05)',
      backgroundOffWhite: '#0A0A0A',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../src/utils/storage', () => ({
  getUserPreferences: jest.fn(async () => null),
}));

jest.mock('../src/components/TaskItem', () => {
  const { Text: RNText } = require('react-native');
  return {
    TaskItem: ({ task }: { task: Task }) => <RNText>{task.title}</RNText>,
  };
});

jest.mock('../src/components/ui', () => {
  const { Pressable } = require('react-native');
  return {
    AnimatedPressable: ({ children, ...props }: any) => <Pressable {...props}>{children}</Pressable>,
  };
});

jest.mock('../src/utils/haptics', () => ({
  haptic: jest.fn(),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const transition = {
    duration: () => transition,
    delay: () => transition,
  };

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    },
    FadeIn: transition,
    FadeInDown: transition,
  };
});

describe('CalendarScreen', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 20, 10, 0, 0, 0));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('renders the redesigned dayboard shell', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <CalendarScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() } as any} />,
      );
    });

    const textNodes = tree!.root.findAllByType(Text).map(node => node.props.children).flat();

    expect(textNodes).toContain('Calendar');
    expect(textNodes).toContain('Committed');
    expect(textNodes).toContain('Queue');
    expect(textNodes).toContain('Recovery');
  });
});
