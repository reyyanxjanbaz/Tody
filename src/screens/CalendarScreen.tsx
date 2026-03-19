import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTasks } from '../context/TaskContext';
import { useTheme } from '../context/ThemeContext';
import { TaskItem } from '../components/TaskItem';
import { AnimatedPressable } from '../components/ui';
import {
  BorderRadius,
  FontFamily,
  FontFamilyBold,
  Spacing,
  type ThemeColors,
} from '../utils/colors';
import { getUserPreferences } from '../utils/storage';
import {
  buildTimelineRows,
  formatCalendarTime,
  formatDayTitle,
  getDayboardData,
  getInitialPreferences,
  getMonthGrid,
  getTaskDurationMinutes,
  getWeekDays,
  isEndOfDayTimestamp,
  resolveSchedulePlacement,
  type TimelineGap,
  type TimelineRow,
} from '../utils/calendarDayboard';
import { startOfDay } from '../utils/dateUtils';
import { isTaskLocked } from '../utils/dependencyChains';
import { formatOverdueGently } from '../utils/decay';
import { haptic } from '../utils/haptics';
import { RootStackParamList, Task, UserPreferences } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Calendar'>;
};

type QueueMode = 'due' | 'flexible';

const WEEKDAY_SHORT_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_SHORT_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TIMELINE_PX_PER_MIN = 0.85;
const TIMELINE_MIN_ITEM_HEIGHT = 84;
const TIMELINE_MAX_ITEM_HEIGHT = 220;
const TIMELINE_MIN_GAP_HEIGHT = 42;

function getDisplayTitle(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getDayChipLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', { weekday: 'short' });
}

function getMonthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getTimelineRowHeight(row: TimelineRow): number {
  const minutes = row.type === 'gap'
    ? Math.max(15, Math.round((row.gap.endAt - row.gap.startAt) / 60000))
    : Math.max(15, Math.round((row.item.endAt - row.item.startAt) / 60000));

  if (row.type === 'gap') {
    return Math.max(TIMELINE_MIN_GAP_HEIGHT, minutes * 0.5);
  }

  return Math.max(
    TIMELINE_MIN_ITEM_HEIGHT,
    Math.min(TIMELINE_MAX_ITEM_HEIGHT, minutes * TIMELINE_PX_PER_MIN),
  );
}

function formatTimeRange(startAt: number, endAt: number, timeFormat: UserPreferences['timeFormat']): string {
  return `${formatCalendarTime(startAt, timeFormat)} - ${formatCalendarTime(endAt, timeFormat)}`;
}

export function CalendarScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const {
    tasks,
    categories,
    activeCategory,
    updateTask,
    completeTask,
    completeTimedTask,
    deferTask,
    reviveTask,
    startTask,
    archiveTask,
  } = useTasks();

  const [prefs, setPrefs] = useState<UserPreferences>(getInitialPreferences(null));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay().getTime());
  const [selectedCategory, setSelectedCategory] = useState(activeCategory);
  const [queueMode, setQueueMode] = useState<QueueMode>('flexible');
  const [monthJumpVisible, setMonthJumpVisible] = useState(false);
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [selectedGap, setSelectedGap] = useState<TimelineGap | null>(null);
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [schedulePickerDate, setSchedulePickerDate] = useState(new Date());
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    (async () => {
      const stored = await getUserPreferences<UserPreferences>();
      setPrefs(getInitialPreferences(stored));
    })();
  }, []);

  useEffect(() => {
    const current = new Date(selectedDate);
    setMonthCursor({ year: current.getFullYear(), month: current.getMonth() });
  }, [selectedDate]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories],
  );

  useEffect(() => {
    const hasSelectedCategory = sortedCategories.some(category => category.id === selectedCategory);
    if (hasSelectedCategory) return;

    const fallbackCategory = sortedCategories.some(category => category.id === activeCategory)
      ? activeCategory
      : 'overview';
    setSelectedCategory(fallbackCategory);
  }, [activeCategory, selectedCategory, sortedCategories]);

  const lockMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const task of tasks) {
      map.set(task.id, isTaskLocked(task, tasks));
    }
    return map;
  }, [tasks]);

  const dayboard = useMemo(
    () => getDayboardData(tasks, selectedDate, selectedCategory),
    [tasks, selectedDate, selectedCategory],
  );

  useEffect(() => {
    setQueueMode(dayboard.dueToday.length > 0 ? 'due' : 'flexible');
  }, [dayboard.dueToday.length, selectedDate, selectedCategory]);

  const weekDays = useMemo(
    () => getWeekDays(selectedDate, prefs.weekStartsOn),
    [prefs.weekStartsOn, selectedDate],
  );

  const monthGrid = useMemo(
    () => getMonthGrid(monthCursor.year, monthCursor.month, prefs.weekStartsOn),
    [monthCursor.month, monthCursor.year, prefs.weekStartsOn],
  );

  const { rows: timelineRows, window: timelineWindow } = useMemo(
    () => buildTimelineRows(dayboard.committed, selectedDate),
    [dayboard.committed, selectedDate],
  );

  const firstGap = useMemo(() => {
    const row = timelineRows.find(item => item.type === 'gap');
    return row?.type === 'gap' ? row.gap : null;
  }, [timelineRows]);

  const weekdayHeaders = prefs.weekStartsOn === 'monday' ? WEEKDAY_SHORT_MON : WEEKDAY_SHORT_SUN;
  const selectedTitle = getDisplayTitle(selectedDate);
  const isSelectedToday = selectedDate === startOfDay().getTime();
  const queueItems = queueMode === 'due' ? dayboard.dueToday : dayboard.flexible;
  const queueEmptyTitle = queueMode === 'due'
    ? 'No date-bound tasks are waiting here.'
    : 'Everything flexible is already placed or cleared.';
  const queueEmptySubtitle = queueMode === 'due'
    ? 'You can keep this day roomy or pull something forward.'
    : 'Keep the schedule breathable, or add a new task from Home.';
  const timelineRangeLabel = `${formatCalendarTime(timelineWindow.startAt, prefs.timeFormat)} - ${formatCalendarTime(timelineWindow.endAt, prefs.timeFormat)}`;

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const openTaskDetail = useCallback((task: Task) => {
    navigation.navigate('TaskDetail', { taskId: task.id });
  }, [navigation]);

  const handleComplete = useCallback((taskId: string) => {
    if (lockMap.get(taskId) ?? false) {
      Alert.alert('Locked', 'Complete all subtasks first.');
      return;
    }

    completeTask(taskId);
  }, [completeTask, lockMap]);

  const commitScheduledPlacement = useCallback((task: Task, startAt: number) => {
    const placement = resolveSchedulePlacement(task, startAt);
    updateTask(task.id, {
      scheduledStartAt: placement.startAt,
      scheduledEndAt: placement.endAt,
    });
    setScheduleTask(null);
    setShowSchedulePicker(false);
    setSelectedGap(null);
    setActionTask(null);
    haptic('success');
  }, [updateTask]);

  const openSchedulePickerForTask = useCallback((task: Task, suggestedStartAt?: number) => {
    const baseTimestamp = task.scheduledStartAt ?? suggestedStartAt ?? Math.max(selectedDate, Date.now());
    setActionTask(null);
    setSelectedGap(null);
    setScheduleTask(task);
    setSchedulePickerDate(new Date(baseTimestamp));
    setShowSchedulePicker(true);
  }, [selectedDate]);

  const scheduleIntoGap = useCallback((task: Task, gap: TimelineGap) => {
    const placement = resolveSchedulePlacement(task, gap.startAt, gap);

    if (!placement.fitsGap) {
      Alert.alert(
        'Pocket too small',
        `This task needs about ${placement.durationMinutes} min, but the open pocket only has ${placement.availableGapMinutes} min.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Pick another time',
            onPress: () => openSchedulePickerForTask(task, gap.startAt),
          },
        ],
      );
      return;
    }

    updateTask(task.id, {
      scheduledStartAt: placement.startAt,
      scheduledEndAt: placement.endAt,
    });
    setSelectedGap(null);
    setActionTask(null);
    haptic('success');
  }, [openSchedulePickerForTask, updateTask]);

  const handleScheduleChange = useCallback((event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowSchedulePicker(false);
      if (event.type === 'set' && nextDate && scheduleTask) {
        commitScheduledPlacement(scheduleTask, nextDate.getTime());
      }
      return;
    }

    if (nextDate) {
      setSchedulePickerDate(nextDate);
    }
  }, [commitScheduledPlacement, scheduleTask]);

  const handleLongPressTask = useCallback((task: Task) => {
    setSelectedGap(null);
    setActionTask(task);
  }, []);

  const handlePlaceSuggestion = useCallback((task: Task) => {
    if (firstGap) {
      scheduleIntoGap(task, firstGap);
      return;
    }

    openSchedulePickerForTask(task);
  }, [firstGap, openSchedulePickerForTask, scheduleIntoGap]);

  const handleAction = useCallback((action: 'now' | 'pick' | 'tomorrow' | 'unschedule' | 'archive' | 'done') => {
    if (!actionTask) return;

    if (action === 'now') {
      startTask(actionTask.id);
      setActionTask(null);
      return;
    }

    if (action === 'pick') {
      openSchedulePickerForTask(actionTask);
      return;
    }

    if (action === 'tomorrow') {
      deferTask(actionTask.id);
    }

    if (action === 'unschedule') {
      updateTask(actionTask.id, { scheduledStartAt: null, scheduledEndAt: null });
    }

    if (action === 'archive') {
      archiveTask(actionTask.id);
    }

    if (action === 'done') {
      handleComplete(actionTask.id);
    }

    setActionTask(null);
  }, [actionTask, archiveTask, deferTask, handleComplete, openSchedulePickerForTask, startTask, updateTask]);

  const jumpDate = useCallback((nextDate: number) => {
    setSelectedDate(startOfDay(new Date(nextDate)).getTime());
    setMonthJumpVisible(false);
  }, []);

  const renderTaskRow = (task: Task) => (
    <View key={task.id} style={styles.taskRow}>
      <TaskItem
        task={task}
        onPress={openTaskDetail}
        onComplete={handleComplete}
        onDefer={deferTask}
        onRevive={reviveTask}
        onStart={startTask}
        onCompleteTimed={completeTimedTask}
        onLongPress={handleLongPressTask}
        isLocked={lockMap.get(task.id) ?? false}
      />
    </View>
  );

  const renderTimelineRow = (row: TimelineRow, index: number) => {
    const rowHeight = getTimelineRowHeight(row);

    if (row.type === 'gap') {
      const gapMinutes = Math.max(15, Math.round((row.gap.endAt - row.gap.startAt) / 60000));

      return (
        <View key={`gap-${row.gap.startAt}-${index}`} style={[styles.timelineRow, { minHeight: rowHeight }]}>
          <View style={styles.timelineAxis}>
            <Text style={styles.timelineAxisLabel}>{formatCalendarTime(row.gap.startAt, prefs.timeFormat)}</Text>
            <View style={styles.timelineAxisRail} />
          </View>

          <AnimatedPressable
            onPress={() => {
              setActionTask(null);
              setSelectedGap(row.gap);
              haptic('selection');
            }}
            hapticStyle="selection"
            style={[styles.timelineGapCard, { minHeight: rowHeight - 8 }]}
          >
            <Text style={styles.timelineGapTitle}>Open pocket</Text>
            <Text style={styles.timelineGapMeta}>{gapMinutes} min available</Text>
            <Text style={styles.timelineGapHint}>Tap to place something flexible here.</Text>
          </AnimatedPressable>
        </View>
      );
    }

    const taskCategory = sortedCategories.find(category => category.id === (row.item.task.category ?? 'personal'));
    const isDeadline = row.item.kind === 'deadline';
    const rangeLabel = formatTimeRange(row.item.startAt, row.item.endAt, prefs.timeFormat);

    return (
      <View key={`item-${row.item.task.id}-${row.item.startAt}`} style={[styles.timelineRow, { minHeight: rowHeight }]}>
        <View style={styles.timelineAxis}>
          <Text style={styles.timelineAxisLabel}>{formatCalendarTime(row.item.startAt, prefs.timeFormat)}</Text>
          <Text style={styles.timelineAxisSecondary}>{formatCalendarTime(row.item.endAt, prefs.timeFormat)}</Text>
          <View style={styles.timelineAxisRail} />
          <View style={styles.timelineAxisDot} />
        </View>

        <AnimatedPressable
          onPress={() => openTaskDetail(row.item.task)}
          onLongPress={() => handleLongPressTask(row.item.task)}
          style={[
            styles.timelineBlock,
            isDeadline ? styles.timelineDeadlineBlock : styles.timelineScheduledBlock,
            { minHeight: rowHeight - 8, borderLeftColor: taskCategory?.color ?? colors.text },
          ]}
        >
          <View style={styles.timelineBlockTop}>
            <View style={styles.timelineKindWrap}>
              <Text style={styles.timelineKindText}>{isDeadline ? 'Deadline' : 'Committed'}</Text>
              <Text style={styles.timelineRangeText}>{rangeLabel}</Text>
            </View>
            {taskCategory && taskCategory.id !== 'overview' && (
              <View style={styles.timelineCategoryWrap}>
                <View style={[styles.timelineCategoryDot, { backgroundColor: taskCategory.color }]} />
                <Text style={styles.timelineCategoryText}>{taskCategory.name}</Text>
              </View>
            )}
          </View>

          <Text style={styles.timelineTaskTitle} numberOfLines={2}>{row.item.task.title}</Text>

          <View style={styles.timelineBlockFooter}>
            <Text style={styles.timelineTaskMeta}>
              {Math.max(15, Math.round((row.item.endAt - row.item.startAt) / 60000))} min
              {row.item.task.estimatedMinutes ? ` · est. ${row.item.task.estimatedMinutes}m` : ''}
            </Text>
            {isDeadline && (
              <Text style={styles.timelineTaskMeta}>
                due {formatCalendarTime(row.item.task.deadline!, prefs.timeFormat)}
              </Text>
            )}
          </View>
        </AnimatedPressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AnimatedPressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>← Home</Text>
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <AnimatedPressable
          onPress={() => jumpDate(Date.now())}
          hapticStyle="light"
          style={styles.todayPill}
        >
          <Text style={styles.todayPillText}>Today</Text>
        </AnimatedPressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
      >
        <Animated.View entering={FadeInDown.duration(240)} style={styles.controlPanel}>
          <View style={styles.controlHeader}>
            <AnimatedPressable
              onPress={() => {
                setMonthJumpVisible(true);
                haptic('selection');
              }}
              style={styles.dateButton}
            >
              <View>
                <Text style={styles.dateLabel}>Dayboard</Text>
                <Text style={styles.dateTitle}>{selectedTitle}</Text>
              </View>
              <Icon name="chevron-down" size={18} color={colors.textSecondary} />
            </AnimatedPressable>

            <View style={styles.metricsWrap}>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{dayboard.committed.length}</Text>
                <Text style={styles.metricLabel}>Committed</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{dayboard.flexibleMinutes}</Text>
                <Text style={styles.metricLabel}>Free min</Text>
              </View>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekStrip}
          >
            {weekDays.map(day => {
              const ts = startOfDay(day).getTime();
              const isActive = ts === selectedDate;
              const isToday = ts === startOfDay().getTime();

              return (
                <AnimatedPressable
                  key={ts}
                  onPress={() => jumpDate(ts)}
                  style={[styles.weekPill, isActive && styles.weekPillActive]}
                >
                  <Text style={[styles.weekPillDay, isActive && styles.weekPillDayActive]}>
                    {getDayChipLabel(ts)}
                  </Text>
                  <Text style={[styles.weekPillDate, isActive && styles.weekPillDateActive]}>
                    {new Date(ts).getDate()}
                  </Text>
                  {isToday && !isActive && <View style={styles.todayDot} />}
                </AnimatedPressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryStrip}
          >
            {sortedCategories.map(category => {
              const isActive = category.id === selectedCategory;
              return (
                <AnimatedPressable
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                >
                  {category.id !== 'overview' && (
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  )}
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {category.name}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(60).duration(220)} style={styles.checkpointPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>{isSelectedToday ? 'Today at a glance' : 'Day snapshot'}</Text>
              <Text style={styles.panelTitle}>Calm, committed, and still adjustable.</Text>
            </View>
            <Text style={styles.panelMeta}>{dayboard.committedMinutes} committed · {dayboard.flexibleMinutes} flexible</Text>
          </View>

          <Text style={styles.panelStatus}>{dayboard.statusText}</Text>

          {dayboard.topSuggestions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionStrip}
            >
              {dayboard.topSuggestions.map(task => (
                <AnimatedPressable
                  key={task.id}
                  onPress={() => handlePlaceSuggestion(task)}
                  style={styles.suggestionCard}
                >
                  <Text style={styles.suggestionTitle} numberOfLines={2}>{task.title}</Text>
                  <Text style={styles.suggestionMeta}>
                    {getTaskDurationMinutes(task)} min
                    {task.deadline
                      ? ` · ${isEndOfDayTimestamp(task.deadline) ? formatDayTitle(task.deadline) : formatCalendarTime(task.deadline, prefs.timeFormat)}`
                      : ''}
                  </Text>
                  <View style={styles.suggestionAction}>
                    <Text style={styles.suggestionActionText}>Place into day</Text>
                    <Icon name="arrow-forward" size={14} color={colors.text} />
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.inlineEmptyCard}>
              <Text style={styles.inlineEmptyTitle}>Nothing urgent to place.</Text>
              <Text style={styles.inlineEmptySubtitle}>Keep the day spacious and let focus breathe.</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.delay(120).duration(220)} style={styles.timelinePanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>Committed</Text>
              <Text style={styles.panelTitle}>The day in time, not just in order.</Text>
            </View>
            <Text style={styles.panelMeta}>{timelineRangeLabel}</Text>
          </View>

          <View style={styles.timelineCanvas}>
            {timelineRows.map(renderTimelineRow)}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(180).duration(220)} style={styles.queuePanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>Queue</Text>
              <Text style={styles.panelTitle}>Due and flexible work, one calmer surface.</Text>
            </View>
            <View style={styles.queueToggle}>
              <AnimatedPressable
                onPress={() => setQueueMode('due')}
                style={[styles.queueToggleButton, queueMode === 'due' && styles.queueToggleButtonActive]}
              >
                <Text style={[styles.queueToggleText, queueMode === 'due' && styles.queueToggleTextActive]}>
                  Due {dayboard.dueToday.length}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => setQueueMode('flexible')}
                style={[styles.queueToggleButton, queueMode === 'flexible' && styles.queueToggleButtonActive]}
              >
                <Text style={[styles.queueToggleText, queueMode === 'flexible' && styles.queueToggleTextActive]}>
                  Flexible {dayboard.flexible.length}
                </Text>
              </AnimatedPressable>
            </View>
          </View>

          <View style={styles.queueBody}>
            {queueItems.length > 0 ? queueItems.map(renderTaskRow) : (
              <View style={styles.inlineEmptyCard}>
                <Text style={styles.inlineEmptyTitle}>{queueEmptyTitle}</Text>
                <Text style={styles.inlineEmptySubtitle}>{queueEmptySubtitle}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(240).duration(220)} style={styles.recoveryPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>Recovery</Text>
              <Text style={styles.panelTitle}>Planning debt stays negotiable.</Text>
            </View>
            <Text style={styles.panelMeta}>{dayboard.renegotiation.length} items</Text>
          </View>

          {dayboard.renegotiation.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recoveryStrip}
            >
              {dayboard.renegotiation.map(task => (
                <View key={task.id} style={styles.recoveryCard}>
                  <Text style={styles.recoveryTitle} numberOfLines={2}>{task.title}</Text>
                  <Text style={styles.recoveryMeta}>Due {formatOverdueGently(task)}. A gentle reset is enough.</Text>
                  <View style={styles.recoveryActions}>
                    <AnimatedPressable
                      onPress={() => deferTask(task.id)}
                      style={styles.recoveryButton}
                    >
                      <Text style={styles.recoveryButtonText}>Tomorrow</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => archiveTask(task.id)}
                      style={styles.recoveryButton}
                    >
                      <Text style={styles.recoveryButtonText}>Archive</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.inlineEmptyCard}>
              <Text style={styles.inlineEmptyTitle}>Nothing needs renegotiation.</Text>
              <Text style={styles.inlineEmptySubtitle}>The backlog is not shouting at you today.</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={monthJumpVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthJumpVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMonthJumpVisible(false)}>
          <Pressable style={[styles.sheet, styles.monthSheet]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.monthHeader}>
              <AnimatedPressable
                onPress={() => {
                  const prevMonth = new Date(monthCursor.year, monthCursor.month - 1, 1);
                  setMonthCursor({ year: prevMonth.getFullYear(), month: prevMonth.getMonth() });
                }}
              >
                <Icon name="chevron-back" size={18} color={colors.text} />
              </AnimatedPressable>
              <Text style={styles.monthTitle}>{getMonthTitle(monthCursor.year, monthCursor.month)}</Text>
              <AnimatedPressable
                onPress={() => {
                  const nextMonth = new Date(monthCursor.year, monthCursor.month + 1, 1);
                  setMonthCursor({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() });
                }}
              >
                <Icon name="chevron-forward" size={18} color={colors.text} />
              </AnimatedPressable>
            </View>

            <View style={styles.monthWeekHeader}>
              {weekdayHeaders.map(label => (
                <Text key={label} style={styles.monthWeekLabel}>{label}</Text>
              ))}
            </View>

            <View style={styles.monthGrid}>
              {monthGrid.map((date, index) => {
                if (!date) {
                  return <View key={`blank-${index}`} style={styles.monthCell} />;
                }

                const ts = startOfDay(date).getTime();
                const isActive = ts === selectedDate;
                const isToday = ts === startOfDay().getTime();

                return (
                  <AnimatedPressable
                    key={ts}
                    onPress={() => jumpDate(ts)}
                    style={[styles.monthCell, isActive && styles.monthCellActive]}
                  >
                    <Text style={[styles.monthCellText, isActive && styles.monthCellTextActive]}>
                      {date.getDate()}
                    </Text>
                    {isToday && !isActive && <View style={styles.monthTodayDot} />}
                  </AnimatedPressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={actionTask != null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTask(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActionTask(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{actionTask?.title}</Text>
            <Text style={styles.sheetSubtitle}>Reframe the task, reschedule it, or clear it without leaving the board.</Text>

            <Text style={styles.sheetGroupLabel}>Reframe now</Text>
            {[
              { key: 'now', label: 'Do now' },
              { key: 'done', label: 'Mark done' },
            ].map(option => {
              const disabled = option.key === 'now' && !!actionTask?.startedAt;
              return (
                <AnimatedPressable
                  key={option.key}
                  disabled={disabled}
                  onPress={() => handleAction(option.key as 'now' | 'done')}
                  style={styles.sheetAction}
                >
                  <Text style={[styles.sheetActionText, disabled && styles.sheetActionTextDisabled]}>
                    {option.label}
                  </Text>
                </AnimatedPressable>
              );
            })}

            <Text style={styles.sheetGroupLabel}>Reschedule</Text>
            {[
              { key: 'pick', label: 'Pick time' },
              { key: 'tomorrow', label: 'Tomorrow' },
              { key: 'unschedule', label: 'Unschedule', disabled: !actionTask?.scheduledStartAt },
            ].map(option => (
              <AnimatedPressable
                key={option.key}
                disabled={!!option.disabled}
                onPress={() => handleAction(option.key as 'pick' | 'tomorrow' | 'unschedule')}
                style={styles.sheetAction}
              >
                <Text style={[styles.sheetActionText, option.disabled && styles.sheetActionTextDisabled]}>
                  {option.label}
                </Text>
              </AnimatedPressable>
            ))}

            <Text style={styles.sheetGroupLabel}>Exit</Text>
            <AnimatedPressable
              onPress={() => handleAction('archive')}
              style={styles.sheetAction}
            >
              <Text style={styles.sheetActionText}>Archive</Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectedGap != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedGap(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedGap(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Place into pocket</Text>
            <Text style={styles.sheetSubtitle}>
              {selectedGap
                ? `${formatCalendarTime(selectedGap.startAt, prefs.timeFormat)} - ${formatCalendarTime(selectedGap.endAt, prefs.timeFormat)}`
                : ''}
            </Text>

            {dayboard.flexible.slice(0, 5).length > 0 ? (
              dayboard.flexible.slice(0, 5).map(task => (
                <AnimatedPressable
                  key={task.id}
                  onPress={() => {
                    if (!selectedGap) return;
                    scheduleIntoGap(task, selectedGap);
                  }}
                  style={styles.sheetAction}
                >
                  <View style={styles.sheetTaskRow}>
                    <Text style={styles.sheetActionText}>{task.title}</Text>
                    <Text style={styles.sheetTaskMeta}>{getTaskDurationMinutes(task)}m</Text>
                  </View>
                </AnimatedPressable>
              ))
            ) : (
              <Text style={styles.sheetSubtitle}>No flexible tasks are waiting to be placed.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {showSchedulePicker && scheduleTask && Platform.OS === 'android' && (
        <DateTimePicker
          value={schedulePickerDate}
          mode="datetime"
          display="default"
          minimumDate={new Date(selectedDate)}
          onChange={handleScheduleChange}
        />
      )}

      <Modal
        visible={showSchedulePicker && scheduleTask != null && Platform.OS === 'ios'}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSchedulePicker(false);
          setScheduleTask(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowSchedulePicker(false);
            setScheduleTask(null);
          }}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pick time</Text>
            <Text style={styles.sheetSubtitle}>{scheduleTask?.title}</Text>
            <DateTimePicker
              value={schedulePickerDate}
              mode="datetime"
              display="spinner"
              minimumDate={new Date(selectedDate)}
              onChange={handleScheduleChange}
              textColor={colors.text}
            />
            <AnimatedPressable
              onPress={() => {
                if (scheduleTask) {
                  commitScheduledPlacement(scheduleTask, schedulePickerDate.getTime());
                }
              }}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmButtonText}>Set block</Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backText: {
    color: c.textSecondary,
    fontSize: 15,
    fontFamily: FontFamily,
  },
  headerTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  todayPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    backgroundColor: c.text,
  },
  todayPillText: {
    color: c.background,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  controlPanel: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: Spacing.lg,
    backgroundColor: c.surface,
    gap: Spacing.md,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  dateLabel: {
    color: c.textTertiary,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: FontFamilyBold,
  },
  dateTitle: {
    color: c.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontFamily: FontFamilyBold,
  },
  metricsWrap: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metricPill: {
    minWidth: 70,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.card,
    backgroundColor: c.background,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  metricValue: {
    color: c.text,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  metricLabel: {
    color: c.textSecondary,
    fontSize: 11,
    fontFamily: FontFamily,
  },
  weekStrip: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  weekPill: {
    width: 56,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.card,
    alignItems: 'center',
    backgroundColor: c.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
  },
  weekPillActive: {
    backgroundColor: c.text,
    borderColor: c.text,
  },
  weekPillDay: {
    color: c.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  weekPillDayActive: {
    color: c.background,
  },
  weekPillDate: {
    color: c.text,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  weekPillDateActive: {
    color: c.background,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.text,
    marginTop: 4,
  },
  categoryStrip: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: c.background,
  },
  categoryChipActive: {
    backgroundColor: isDark ? c.gray100 : c.white,
    borderColor: c.text,
  },
  categoryChipText: {
    color: c.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  categoryChipTextActive: {
    color: c.text,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checkpointPanel: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  panelEyebrow: {
    color: c.textTertiary,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: FontFamilyBold,
  },
  panelTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily: FontFamilyBold,
  },
  panelMeta: {
    color: c.textSecondary,
    fontSize: 13,
    fontFamily: FontFamily,
  },
  panelStatus: {
    color: c.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FontFamily,
  },
  suggestionStrip: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  suggestionCard: {
    width: 232,
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: Spacing.md,
    backgroundColor: c.surface,
    gap: Spacing.sm,
  },
  suggestionTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  suggestionMeta: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily,
  },
  suggestionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 'auto',
  },
  suggestionActionText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  timelinePanel: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  timelineCanvas: {
    gap: Spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  timelineAxis: {
    width: 72,
    position: 'relative',
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  timelineAxisLabel: {
    color: c.text,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  timelineAxisSecondary: {
    color: c.textTertiary,
    fontSize: 11,
    marginTop: 2,
    fontFamily: FontFamily,
  },
  timelineAxisRail: {
    position: 'absolute',
    top: 18,
    bottom: 0,
    left: 36,
    width: 1,
    backgroundColor: c.border,
  },
  timelineAxisDot: {
    position: 'absolute',
    top: 18,
    left: 33,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.text,
  },
  timelineBlock: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderLeftWidth: 2,
    padding: Spacing.md,
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  timelineScheduledBlock: {
    backgroundColor: c.background,
  },
  timelineDeadlineBlock: {
    backgroundColor: isDark ? c.gray100 : c.white,
  },
  timelineBlockTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  timelineKindWrap: {
    gap: 4,
  },
  timelineKindText: {
    color: c.textSecondary,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: FontFamilyBold,
  },
  timelineRangeText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  timelineCategoryWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timelineCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineCategoryText: {
    color: c.textSecondary,
    fontSize: 12,
    fontFamily: FontFamily,
  },
  timelineTaskTitle: {
    color: c.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  timelineBlockFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  timelineTaskMeta: {
    color: c.textSecondary,
    fontSize: 12,
    fontFamily: FontFamily,
  },
  timelineGapCard: {
    flex: 1,
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderStyle: 'dashed',
    padding: Spacing.md,
    justifyContent: 'center',
    backgroundColor: c.surfaceGlass,
    gap: 4,
  },
  timelineGapTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  timelineGapMeta: {
    color: c.textSecondary,
    fontSize: 12,
    fontFamily: FontFamily,
  },
  timelineGapHint: {
    color: c.textTertiary,
    fontSize: 12,
    fontFamily: FontFamily,
  },
  queuePanel: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  queueToggle: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: 4,
    borderRadius: BorderRadius.pill,
    backgroundColor: c.background,
  },
  queueToggleButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.pill,
  },
  queueToggleButtonActive: {
    backgroundColor: c.text,
  },
  queueToggleText: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  queueToggleTextActive: {
    color: c.background,
  },
  queueBody: {
    gap: 4,
  },
  taskRow: {
    marginHorizontal: -Spacing.md,
  },
  recoveryPanel: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  recoveryStrip: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  recoveryCard: {
    width: 260,
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: Spacing.md,
    backgroundColor: c.surface,
    gap: Spacing.md,
  },
  recoveryTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  recoveryMeta: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FontFamily,
  },
  recoveryActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  recoveryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  recoveryButtonText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  inlineEmptyCard: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: Spacing.lg,
    gap: 4,
  },
  inlineEmptyTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  inlineEmptySubtitle: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FontFamily,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: c.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  monthSheet: {
    maxHeight: '70%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.gray400,
    marginBottom: Spacing.sm,
  },
  sheetTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  sheetSubtitle: {
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily,
  },
  sheetGroupLabel: {
    color: c.textTertiary,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    fontFamily: FontFamilyBold,
  },
  sheetAction: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: c.surface,
  },
  sheetActionText: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  sheetActionTextDisabled: {
    color: c.textTertiary,
  },
  sheetTaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sheetTaskMeta: {
    color: c.textSecondary,
    fontSize: 13,
    fontFamily: FontFamily,
  },
  confirmButton: {
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: c.text,
  },
  confirmButtonText: {
    color: c.background,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  monthTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  monthWeekHeader: {
    flexDirection: 'row',
  },
  monthWeekLabel: {
    flex: 1,
    textAlign: 'center',
    color: c.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '14.285%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthCellActive: {
    backgroundColor: c.text,
    borderRadius: BorderRadius.card,
  },
  monthCellText: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  monthCellTextActive: {
    color: c.background,
  },
  monthTodayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.text,
    marginTop: 4,
  },
});
