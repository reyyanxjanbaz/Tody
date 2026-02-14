/**
 * CalendarStrip – horizontal scrollable date picker.
 *
 * Displays a rolling window of dates (2 weeks past, 2 weeks future).
 * Each item shows the day-of-week abbreviation and date number.
 * Tapping a date selects it and fires `onDateChange`.
 * Auto-scrolls to "today" on mount.
 *
 * Design: inherits all styling from the app's design system –
 * Colors, Typography, Spacing, BorderRadius, animations, and haptics.
 */

import React, { memo, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors, Spacing, Typography, BorderRadius } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { SPRING_SNAPPY, TIMING_FADE, PRESS_SCALE } from '../utils/animations';
import { haptic } from '../utils/haptics';
import { startOfDay, addDays } from '../utils/dateUtils';

// ── Constants ───────────────────────────────────────────────────────────────

const PAST_DAYS = 14;
const FUTURE_DAYS = 14;
const TOTAL_DAYS = PAST_DAYS + 1 + FUTURE_DAYS; // 29 days
const TODAY_INDEX = PAST_DAYS;
const ITEM_WIDTH = 48;
const ITEM_MARGIN = Spacing.xs;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Types ───────────────────────────────────────────────────────────────────

interface CalendarDay {
  key: string;       // YYYY-MM-DD
  date: Date;
  dayLabel: string;  // "Mon", "Tue", …
  dateNum: number;   // 1–31
  isToday: boolean;
  timestamp: number; // start-of-day ms
}

interface CalendarStripProps {
  selectedDate: number;           // start-of-day timestamp
  onDateChange: (ts: number) => void;
}

// ── Generate days array ─────────────────────────────────────────────────────

function generateDays(): CalendarDay[] {
  const today = startOfDay();
  const days: CalendarDay[] = [];

  for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i++) {
    const d = addDays(today, i);
    const ts = d.getTime();
    days.push({
      key: d.toISOString().slice(0, 10),
      date: d,
      dayLabel: DAY_LABELS[d.getDay()],
      dateNum: d.getDate(),
      isToday: i === 0,
      timestamp: ts,
    });
  }

  return days;
}

// ── Single day cell ─────────────────────────────────────────────────────────

interface DayCellProps {
  day: CalendarDay;
  isSelected: boolean;
  onSelect: (ts: number) => void;
  themeColors: ReturnType<typeof useTheme>['colors'];
}

const DayCell = memo(function DayCell({ day, isSelected, onSelect, themeColors }: DayCellProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const firePress = useCallback(() => {
    haptic('light');
    onSelect(day.timestamp);
  }, [day.timestamp, onSelect]);

  const gesture = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(PRESS_SCALE, SPRING_SNAPPY);
      opacity.value = withTiming(0.7, TIMING_FADE);
    })
    .onFinalize((_e, success) => {
      'worklet';
      scale.value = withSpring(1, SPRING_SNAPPY);
      opacity.value = withTiming(1, TIMING_FADE);
      if (success) {
        runOnJS(firePress)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.dayCell,
          isSelected && [styles.dayCellSelected, { backgroundColor: themeColors.calendarSelected }],
          animatedStyle,
        ]}
      >
        <Text
          style={[
            styles.dayLabel,
            { color: themeColors.textTertiary },
            isSelected && { color: themeColors.calendarSelectedText },
            day.isToday && !isSelected && { color: themeColors.textSecondary },
          ]}
        >
          {day.dayLabel}
        </Text>
        <Text
          style={[
            styles.dateNum,
            { color: themeColors.text },
            isSelected && { color: themeColors.calendarSelectedText, fontWeight: '700' },
            day.isToday && !isSelected && { fontWeight: '700' },
          ]}
        >
          {day.dateNum}
        </Text>
        {day.isToday && !isSelected && <View style={[styles.todayDot, { backgroundColor: themeColors.todayDot }]} />}
      </Animated.View>
    </GestureDetector>
  );
});

// ── Main component ──────────────────────────────────────────────────────────

export const CalendarStrip = memo(function CalendarStrip({
  selectedDate,
  onDateChange,
}: CalendarStripProps) {
  const scrollRef = useRef<ScrollView>(null);
  const days = useMemo(() => generateDays(), []);
  const itemFullWidth = ITEM_WIDTH + ITEM_MARGIN * 2;
  const { colors } = useTheme();

  // Scroll to today on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const offset = TODAY_INDEX * itemFullWidth - 140; // roughly centre
      scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [itemFullWidth]);

  const handleSelect = useCallback(
    (ts: number) => {
      onDateChange(ts);
    },
    [onDateChange],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {days.map(day => (
          <DayCell
            key={day.key}
            day={day}
            isSelected={day.timestamp === selectedDate}
            onSelect={handleSelect}
            themeColors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );
});

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  dayCell: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginHorizontal: ITEM_MARGIN,
    borderRadius: BorderRadius.button,
    backgroundColor: 'transparent',
  },
  dayCellSelected: {
    // backgroundColor applied inline via themeColors
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: Spacing.xs,
  },
  dateNum: {
    fontSize: 18,
    fontWeight: '600',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.xs,
  },
});
