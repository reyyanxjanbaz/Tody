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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTasks } from '../context/TaskContext';
import { useTheme } from '../context/ThemeContext';
import { AnimatedPressable } from '../components/ui';
import { TaskItem } from '../components/TaskItem';
import {
  BorderRadius,
  FontFamily,
  FontFamilyBold,
  Spacing,
  type ThemeColors,
} from '../utils/colors';
import { getUserPreferences } from '../utils/storage';
import {
  formatCalendarTime,
  formatDaySubtitle,
  formatDayTitle,
  getDayboardData,
  getInitialPreferences,
  getMonthGrid,
  getTaskDurationMinutes,
  getWeekDays,
  isEndOfDayTimestamp,
  type DayboardTimelineItem,
} from '../utils/calendarDayboard';
import { startOfDay } from '../utils/dateUtils';
import { isTaskLocked } from '../utils/dependencyChains';
import { formatOverdueGently } from '../utils/decay';
import { haptic } from '../utils/haptics';
import { RootStackParamList, Task, UserPreferences } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Calendar'>;
};

type TimelineGap = {
  startAt: number;
  endAt: number;
};

type TimelineRow =
  | { type: 'gap'; gap: TimelineGap }
  | { type: 'item'; item: DayboardTimelineItem };

const WEEKDAY_SHORT_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_SHORT_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_WINDOW_START_HOUR = 7;
const DAY_WINDOW_END_HOUR = 22;
const MIN_GAP_MINUTES = 20;

function buildTimelineRows(items: DayboardTimelineItem[], selectedDate: number): TimelineRow[] {
  const windowStart = startOfDay(new Date(selectedDate)).getTime() + DAY_WINDOW_START_HOUR * 60 * 60 * 1000;
  const windowEnd = startOfDay(new Date(selectedDate)).getTime() + DAY_WINDOW_END_HOUR * 60 * 60 * 1000;
  const clampedItems = items
    .map(item => ({
      ...item,
      startAt: Math.max(windowStart, item.startAt),
      endAt: Math.min(windowEnd, Math.max(item.endAt, item.startAt + 15 * 60 * 1000)),
    }))
    .filter(item => item.endAt > windowStart && item.startAt < windowEnd)
    .sort((a, b) => a.startAt - b.startAt);

  const rows: TimelineRow[] = [];
  let cursor = windowStart;

  for (const item of clampedItems) {
    if (item.startAt - cursor >= MIN_GAP_MINUTES * 60 * 1000) {
      rows.push({
        type: 'gap',
        gap: { startAt: cursor, endAt: item.startAt },
      });
    }

    rows.push({ type: 'item', item });
    cursor = Math.max(cursor, item.endAt);
  }

  if (windowEnd - cursor >= MIN_GAP_MINUTES * 60 * 1000 || rows.length === 0) {
    rows.push({
      type: 'gap',
      gap: { startAt: cursor, endAt: windowEnd },
    });
  }

  return rows;
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
  const [monthJumpVisible, setMonthJumpVisible] = useState(false);
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [selectedGap, setSelectedGap] = useState<TimelineGap | null>(null);
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [schedulePickerDate, setSchedulePickerDate] = useState(new Date());
  const [monthCursor, setMonthCursor] = useState(() => {
    const initial = new Date();
    return { year: initial.getFullYear(), month: initial.getMonth() };
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

  const weekDays = useMemo(
    () => getWeekDays(selectedDate, prefs.weekStartsOn),
    [selectedDate, prefs.weekStartsOn],
  );

  const monthGrid = useMemo(
    () => getMonthGrid(monthCursor.year, monthCursor.month, prefs.weekStartsOn),
    [monthCursor.year, monthCursor.month, prefs.weekStartsOn],
  );

  const timelineRows = useMemo(
    () => buildTimelineRows(dayboard.committed, selectedDate),
    [dayboard.committed, selectedDate],
  );

  const firstGap = useMemo(() => {
    const gapRow = timelineRows.find(row => row.type === 'gap');
    return gapRow?.type === 'gap' ? gapRow.gap : null;
  }, [timelineRows]);

  const weekdayHeaders = prefs.weekStartsOn === 'monday' ? WEEKDAY_SHORT_MON : WEEKDAY_SHORT_SUN;
  const selectedTitle = `${formatDayTitle(selectedDate)}, ${formatDaySubtitle(selectedDate)}`;
  const isSelectedToday = selectedDate === startOfDay().getTime();

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const openTaskDetail = useCallback((task: Task) => {
    navigation.navigate('TaskDetail', { taskId: task.id });
  }, [navigation]);

  const handleComplete = useCallback((taskId: string) => {
    const target = tasks.find(task => task.id === taskId);
    if (target && (lockMap.get(taskId) ?? false)) {
      Alert.alert('Locked', 'Complete all subtasks first.');
      return;
    }
    completeTask(taskId);
  }, [completeTask, lockMap, tasks]);

  const handleStart = useCallback((taskId: string) => {
    startTask(taskId);
  }, [startTask]);

  const openSchedulePickerForTask = useCallback((task: Task) => {
    setActionTask(null);
    setSelectedGap(null);
    const baseDate = task.scheduledStartAt
      ? new Date(task.scheduledStartAt)
      : new Date(Math.max(selectedDate, Date.now()));
    setScheduleTask(task);
    setSchedulePickerDate(baseDate);
    setShowSchedulePicker(true);
  }, [selectedDate]);

  const applySchedule = useCallback((task: Task, startAt: number) => {
    const durationMs = getTaskDurationMinutes(task) * 60 * 1000;
    updateTask(task.id, {
      scheduledStartAt: startAt,
      scheduledEndAt: startAt + durationMs,
    });
    setScheduleTask(null);
    setShowSchedulePicker(false);
    setSelectedGap(null);
    haptic('success');
  }, [updateTask]);

  const handleScheduleChange = useCallback((event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowSchedulePicker(false);
      if (event.type === 'set' && nextDate && scheduleTask) {
        applySchedule(scheduleTask, nextDate.getTime());
      }
      return;
    }

    if (nextDate) {
      setSchedulePickerDate(nextDate);
    }
  }, [applySchedule, scheduleTask]);

  const handleLongPressTask = useCallback((task: Task) => {
    setSelectedGap(null);
    setActionTask(task);
  }, []);

  const handleGapPress = useCallback((gap: TimelineGap) => {
    haptic('selection');
    setActionTask(null);
    setSelectedGap(gap);
  }, []);

  const handlePlaceSuggestion = useCallback((task: Task) => {
    if (firstGap) {
      applySchedule(task, firstGap.startAt);
      return;
    }

    openSchedulePickerForTask(task);
  }, [applySchedule, firstGap, openSchedulePickerForTask]);

  const handleAction = useCallback((action: 'now' | 'pick' | 'tomorrow' | 'unschedule' | 'archive' | 'done') => {
    if (!actionTask) return;

    if (action === 'now') {
      startTask(actionTask.id);
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

  const handleGapTaskPick = useCallback((task: Task) => {
    if (!selectedGap) return;
    applySchedule(task, selectedGap.startAt);
  }, [applySchedule, selectedGap]);

  const renderTaskRow = useCallback((task: Task) => (
    <View key={task.id} style={styles.taskRow}>
      <TaskItem
        task={task}
        onPress={openTaskDetail}
        onComplete={handleComplete}
        onDefer={deferTask}
        onRevive={reviveTask}
        onStart={handleStart}
        onCompleteTimed={completeTimedTask}
        onLongPress={handleLongPressTask}
        isLocked={lockMap.get(task.id) ?? false}
      />
    </View>
  ), [
    completeTimedTask,
    deferTask,
    handleComplete,
    handleLongPressTask,
    handleStart,
    lockMap,
    openTaskDetail,
    reviveTask,
  ]);

  const renderTimelineRow = useCallback((row: TimelineRow, index: number) => {
    if (row.type === 'gap') {
      const gapMinutes = Math.max(15, Math.round((row.gap.endAt - row.gap.startAt) / 60000));
      return (
        <AnimatedPressable
          key={`gap-${row.gap.startAt}-${index}`}
          onPress={() => handleGapPress(row.gap)}
          hapticStyle="selection"
          style={styles.gapRow}
        >
          <View style={styles.gapTime}>
            <Text style={styles.gapTimeLabel}>{formatCalendarTime(row.gap.startAt, prefs.timeFormat)}</Text>
            <Text style={styles.gapTimeMeta}>{gapMinutes} min free</Text>
          </View>
          <View style={styles.gapCard}>
            <Text style={styles.gapTitle}>Open pocket</Text>
            <Text style={styles.gapSubtitle}>Tap to place a flexible task here.</Text>
          </View>
        </AnimatedPressable>
      );
    }

    const taskCategory = sortedCategories.find(category => category.id === (row.item.task.category ?? 'personal'));
    const isDeadlineMarker = row.item.kind === 'deadline';

    return (
      <AnimatedPressable
        key={`item-${row.item.task.id}-${row.item.startAt}`}
        onPress={() => openTaskDetail(row.item.task)}
        onLongPress={() => handleLongPressTask(row.item.task)}
        style={styles.timelineRow}
      >
        <View style={styles.timelineTime}>
          <Text style={styles.timelineTimeLabel}>{formatCalendarTime(row.item.startAt, prefs.timeFormat)}</Text>
          <Text style={styles.timelineTimeMeta}>
            {Math.max(15, Math.round((row.item.endAt - row.item.startAt) / 60000))} min
          </Text>
        </View>
        <View style={[
          styles.timelineCard,
          { borderLeftColor: taskCategory?.color ?? colors.text },
        ]}>
          <View style={styles.timelineCardTop}>
            <Text style={styles.timelineTaskTitle} numberOfLines={2}>
              {row.item.task.title}
            </Text>
            {isDeadlineMarker && (
              <View style={styles.timelineBadge}>
                <Text style={styles.timelineBadgeText}>Deadline</Text>
              </View>
            )}
          </View>
          <Text style={styles.timelineTaskMeta}>
            {taskCategory?.name ?? 'Personal'}
            {row.item.task.estimatedMinutes ? ` · est. ${row.item.task.estimatedMinutes}m` : ''}
            {row.item.task.deadline && !isDeadlineMarker ? ` · due ${formatCalendarTime(row.item.task.deadline, prefs.timeFormat)}` : ''}
          </Text>
        </View>
      </AnimatedPressable>
    );
  }, [
    colors.text,
    handleGapPress,
    handleLongPressTask,
    openTaskDetail,
    prefs.timeFormat,
    sortedCategories,
    styles.gapCard,
    styles.gapRow,
    styles.gapSubtitle,
    styles.gapTime,
    styles.gapTimeLabel,
    styles.gapTimeMeta,
    styles.gapTitle,
    styles.timelineBadge,
    styles.timelineBadgeText,
    styles.timelineCard,
    styles.timelineCardTop,
    styles.timelineRow,
    styles.timelineTaskMeta,
    styles.timelineTaskTitle,
    styles.timelineTime,
    styles.timelineTimeLabel,
    styles.timelineTimeMeta,
  ]);

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
        <Animated.View entering={FadeInDown.duration(260)} style={styles.heroCard}>
          <AnimatedPressable
            onPress={() => {
              setMonthJumpVisible(true);
              haptic('selection');
            }}
            style={styles.dateTitleWrap}
          >
            <Text style={styles.dateTitle}>{selectedTitle}</Text>
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </AnimatedPressable>

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
                    {formatDaySubtitle(ts).slice(0, 3)}
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

          <View style={styles.checkpointCard}>
            <View style={styles.checkpointHeader}>
              <Text style={styles.checkpointTitle}>
                {isSelectedToday ? 'Morning Checkpoint' : 'Dayboard Snapshot'}
              </Text>
              <Text style={styles.checkpointMeta}>
                {dayboard.committedMinutes} committed · {dayboard.flexibleMinutes} flexible
              </Text>
            </View>
            <Text style={styles.checkpointStatus}>{dayboard.statusText}</Text>
            {dayboard.topSuggestions.length > 0 ? (
              <View style={styles.suggestionList}>
                {dayboard.topSuggestions.map((task, index) => (
                  <View key={task.id} style={styles.suggestionRow}>
                    <View style={styles.suggestionCopy}>
                      <Text style={styles.suggestionIndex}>0{index + 1}</Text>
                      <View style={styles.suggestionTextWrap}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>{task.title}</Text>
                        <Text style={styles.suggestionMeta}>
                          {getTaskDurationMinutes(task)} min
                          {task.deadline ? ` · due ${isEndOfDayTimestamp(task.deadline) ? formatDayTitle(task.deadline) : formatCalendarTime(task.deadline, prefs.timeFormat)}` : ''}
                        </Text>
                      </View>
                    </View>
                    <AnimatedPressable
                      onPress={() => handlePlaceSuggestion(task)}
                      hapticStyle="light"
                      style={styles.placeButton}
                    >
                      <Text style={styles.placeButtonText}>Place</Text>
                    </AnimatedPressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.checkpointEmpty}>
                Nothing urgent to place. Keep the day spacious.
              </Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(100).duration(220)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Committed</Text>
            <Text style={styles.sectionCount}>{dayboard.committed.length}</Text>
          </View>
          <View style={styles.timelineSection}>
            {timelineRows.map(renderTimelineRow)}
          </View>
        </Animated.View>

        {dayboard.dueToday.length > 0 && (
          <Animated.View entering={FadeIn.delay(140).duration(220)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {isSelectedToday ? 'Due Today' : 'Due This Day'}
              </Text>
              <Text style={styles.sectionCount}>{dayboard.dueToday.length}</Text>
            </View>
            <View style={styles.listSection}>
              {dayboard.dueToday.map(renderTaskRow)}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.delay(180).duration(220)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Flexible</Text>
            <Text style={styles.sectionCount}>{dayboard.flexible.length}</Text>
          </View>
          <View style={styles.listSection}>
            {dayboard.flexible.length > 0 ? (
              dayboard.flexible.map(renderTaskRow)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>This day already has shape.</Text>
                <Text style={styles.emptySubtitle}>
                  No loose tasks are asking for attention right now.
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {dayboard.renegotiation.length > 0 && (
          <Animated.View entering={FadeIn.delay(220).duration(220)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Needs Renegotiation</Text>
              <Text style={styles.sectionCount}>{dayboard.renegotiation.length}</Text>
            </View>
            <View style={styles.listSection}>
              {dayboard.renegotiation.map(task => (
                <View key={task.id} style={styles.renegotiationCard}>
                  <View style={styles.renegotiationCopy}>
                    <Text style={styles.renegotiationTitle}>{task.title}</Text>
                    <Text style={styles.renegotiationMeta}>
                      Due {formatOverdueGently(task)}. A small reset is enough.
                    </Text>
                  </View>
                  <View style={styles.renegotiationActions}>
                    <AnimatedPressable
                      onPress={() => {
                        deferTask(task.id);
                        haptic('light');
                      }}
                      style={styles.secondaryInlineButton}
                    >
                      <Text style={styles.secondaryInlineButtonText}>Tomorrow</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => archiveTask(task.id)}
                      style={styles.secondaryInlineButton}
                    >
                      <Text style={styles.secondaryInlineButtonText}>Archive</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <Modal
        visible={monthJumpVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthJumpVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMonthJumpVisible(false)}>
          <Pressable style={styles.monthModal} onPress={() => {}}>
            <View style={styles.monthHeader}>
              <AnimatedPressable
                onPress={() => {
                  const prevMonth = new Date(monthCursor.year, monthCursor.month - 1, 1);
                  setMonthCursor({ year: prevMonth.getFullYear(), month: prevMonth.getMonth() });
                }}
              >
                <Icon name="chevron-back" size={18} color={colors.text} />
              </AnimatedPressable>
              <Text style={styles.monthTitle}>
                {new Date(monthCursor.year, monthCursor.month, 1).toLocaleString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
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
            <Text style={styles.sheetTitle}>{actionTask?.title}</Text>
            <Text style={styles.sheetSubtitle}>Move gently. Nothing here forks task state.</Text>
            {[
              { key: 'now', label: 'Do now' },
              { key: 'pick', label: 'Pick time' },
              { key: 'tomorrow', label: 'Tomorrow' },
              { key: 'unschedule', label: 'Unschedule' },
              { key: 'archive', label: 'Archive' },
              { key: 'done', label: 'Mark done' },
            ].map(option => {
              const disabled = option.key === 'unschedule' && !actionTask?.scheduledStartAt;
              const isNowDisabled = option.key === 'now' && !!actionTask?.startedAt;
              const isDisabled = disabled || isNowDisabled;

              return (
                <AnimatedPressable
                  key={option.key}
                  disabled={isDisabled}
                  onPress={() => handleAction(option.key as 'now' | 'pick' | 'tomorrow' | 'unschedule' | 'archive' | 'done')}
                  style={styles.sheetAction}
                >
                  <Text style={[styles.sheetActionText, isDisabled && styles.sheetActionTextDisabled]}>
                    {option.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
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
            <Text style={styles.sheetTitle}>Place a task</Text>
            <Text style={styles.sheetSubtitle}>
              {selectedGap
                ? `${formatCalendarTime(selectedGap.startAt, prefs.timeFormat)} to ${formatCalendarTime(selectedGap.endAt, prefs.timeFormat)}`
                : ''}
            </Text>
            {dayboard.flexible.slice(0, 5).length > 0 ? (
              dayboard.flexible.slice(0, 5).map(task => (
                <AnimatedPressable
                  key={task.id}
                  onPress={() => handleGapTaskPick(task)}
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
            <Text style={styles.sheetTitle}>Pick time</Text>
            <Text style={styles.sheetSubtitle}>
              {scheduleTask?.title}
            </Text>
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
                  applySchedule(scheduleTask, schedulePickerDate.getTime());
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
    gap: Spacing.xxl,
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
  heroCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: Spacing.lg,
    backgroundColor: c.surface,
    gap: Spacing.lg,
  },
  dateTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateTitle: {
    flexShrink: 1,
    color: c.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontFamily: FontFamilyBold,
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
    borderWidth: StyleSheet.hairlineWidth,
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
  checkpointCard: {
    borderRadius: BorderRadius.card,
    backgroundColor: c.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  checkpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  checkpointTitle: {
    color: c.text,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  checkpointMeta: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  checkpointStatus: {
    color: c.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FontFamily,
  },
  checkpointEmpty: {
    color: c.textTertiary,
    fontSize: 14,
    fontFamily: FontFamily,
  },
  suggestionList: {
    gap: Spacing.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  suggestionCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  suggestionIndex: {
    width: 26,
    color: c.textTertiary,
    fontSize: 12,
    letterSpacing: 0.8,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  suggestionMeta: {
    color: c.textSecondary,
    fontSize: 13,
    fontFamily: FontFamily,
  },
  placeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.pill,
    backgroundColor: c.text,
  },
  placeButtonText: {
    color: c.background,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontFamily: FontFamilyBold,
  },
  sectionCount: {
    color: c.textTertiary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  timelineSection: {
    gap: Spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  timelineTime: {
    width: 72,
    paddingTop: Spacing.md,
  },
  timelineTimeLabel: {
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  timelineTimeMeta: {
    color: c.textTertiary,
    fontSize: 12,
    fontFamily: FontFamily,
  },
  timelineCard: {
    flex: 1,
    borderRadius: BorderRadius.card,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderLeftWidth: 2,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  timelineCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  timelineTaskTitle: {
    flex: 1,
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  timelineTaskMeta: {
    color: c.textSecondary,
    fontSize: 13,
    fontFamily: FontFamily,
  },
  timelineBadge: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: c.gray100,
  },
  timelineBadgeText: {
    color: c.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  gapRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  gapTime: {
    width: 72,
    justifyContent: 'center',
  },
  gapTimeLabel: {
    color: c.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  gapTimeMeta: {
    color: c.textTertiary,
    fontSize: 11,
    fontFamily: FontFamily,
  },
  gapCard: {
    flex: 1,
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderStyle: 'dashed',
    padding: Spacing.md,
    backgroundColor: c.surfaceGlass,
  },
  gapTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  gapSubtitle: {
    color: c.textSecondary,
    fontSize: 13,
    fontFamily: FontFamily,
  },
  listSection: {
    gap: 2,
  },
  taskRow: {
    marginHorizontal: -Spacing.xxl,
  },
  emptyCard: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: Spacing.lg,
    backgroundColor: c.surface,
    gap: Spacing.xs,
  },
  emptyTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  emptySubtitle: {
    color: c.textSecondary,
    fontSize: 14,
    fontFamily: FontFamily,
  },
  renegotiationCard: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  renegotiationCopy: {
    gap: 4,
  },
  renegotiationTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  renegotiationMeta: {
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily,
  },
  renegotiationActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryInlineButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  secondaryInlineButtonText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamilyBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  monthModal: {
    borderRadius: 24,
    backgroundColor: c.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    aspectRatio: 1,
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
  sheet: {
    marginTop: 'auto',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: c.background,
    padding: Spacing.lg,
    gap: Spacing.sm,
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
});
