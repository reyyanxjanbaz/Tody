/**
 * MonthlyCalendar – Full-month grid showing task completion status per day.
 *
 * Legend:
 *   • No outline / plain: no tasks scheduled
 *   • Outlined ring: incomplete tasks exist
 *   • Filled dot: all tasks that day were completed
 *
 * Navigation: ← prev month · "Today" pill · next month →
 * Today's cell gets a subtle underline highlight.
 */

import React, { memo, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { DayTaskStatus } from '../../types';
import { getMonthCalendarData } from '../../utils/profileStats';
import { Task } from '../../types';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../../utils/colors';
import { useTheme } from '../../context/ThemeContext';
import { haptic } from '../../utils/haptics';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DOW_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MonthlyCalendarProps {
  tasks: Task[];
}

export const MonthlyCalendar = memo(function MonthlyCalendar({
  tasks,
}: MonthlyCalendarProps) {
  const today = new Date();
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const calendarData = useMemo(
    () => getMonthCalendarData(tasks, year, month),
    [tasks, year, month],
  );

  const firstDayOffset = useMemo(
    () => new Date(year, month, 1).getDay(),
    [year, month],
  );

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const handlePrev = useCallback(() => {
    haptic('light');
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  }, [month]);

  const handleNext = useCallback(() => {
    haptic('light');
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  }, [month]);

  const handleToday = useCallback(() => {
    haptic('light');
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }, [today]);

  // Build grid cells: offset blanks + day statuses
  const cells: (DayTaskStatus | null)[] = useMemo(() => {
    const blanks: null[] = Array(firstDayOffset).fill(null);
    return [...blanks, ...calendarData];
  }, [firstDayOffset, calendarData]);

  // Chunk into weeks (rows of 7)
  const weeks = useMemo(() => {
    const rows: (DayTaskStatus | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const row = cells.slice(i, i + 7);
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [cells]);

  return (
    <Animated.View
      entering={FadeInDown.delay(280).duration(350)}
      style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Month Navigation */}
      <View style={styles.navRow}>
        <Pressable onPress={handlePrev} hitSlop={12} style={styles.navArrow}>
          <Icon name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {MONTH_NAMES[month]} {year}
          </Text>
          {!isCurrentMonth && (
            <Pressable onPress={handleToday} style={[styles.todayPill, { backgroundColor: isDark ? '#F5F5F7' : colors.surfaceDark }]}>
              <Text style={[styles.todayPillText, { color: isDark ? '#000' : colors.white }]}>Today</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={handleNext} hitSlop={12} style={styles.navArrow}>
          <Icon name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* DOW Headers */}
      <View style={styles.dowRow}>
        {DOW_HEADERS.map((d, i) => (
          <View key={i} style={styles.dowCell}>
            <Text style={[styles.dowText, { color: colors.textTertiary }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell, ci) => {
            if (!cell) {
              return <View key={ci} style={styles.dayCell} />;
            }
            const d = new Date(cell.date);
            const dayNum = d.getDate();
            const isToday =
              d.getDate() === today.getDate() &&
              d.getMonth() === today.getMonth() &&
              d.getFullYear() === today.getFullYear();

            return (
              <View key={ci} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayCircle,
                    isToday && styles.todayCircle,
                  ]}>
                  <Text
                    style={[
                      styles.dayNumber, { color: colors.text },
                      isToday && styles.todayNumber,
                    ]}>
                    {dayNum}
                  </Text>
                </View>
                {/* Status indicator */}
                {cell.allDone && (
                  <View style={styles.dotFilled} />
                )}
                {cell.hasIncomplete && !cell.allDone && (
                  <View style={styles.dotOutline} />
                )}
              </View>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.dotFilled} />
          <Text style={styles.legendText}>All done</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.dotOutline} />
          <Text style={styles.legendText}>Has incomplete</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const CELL_SIZE = 40;

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navArrow: {
    padding: Spacing.xs,
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    fontFamily: FontFamily,
  },
  todayPill: {
    backgroundColor: c.surfaceDark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: c.white,
    fontFamily: FontFamily,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  dowCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dowText: {
    ...Typography.small,
    fontWeight: '600',
    color: c.textTertiary,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: CELL_SIZE,
    justifyContent: 'center',
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayCircle: {
    backgroundColor: c.surfaceDark,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
    fontFamily: FontFamily,
  },
  todayNumber: {
    color: c.white,
    fontWeight: '700',
  },
  dotFilled: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: c.surfaceDark,
    marginTop: 2,
  },
  dotOutline: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: c.gray500,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendText: {
    ...Typography.small,
    color: c.textTertiary,
  },
});
