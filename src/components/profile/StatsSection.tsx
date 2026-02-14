/**
 * StatsSection – Scrollable productivity metrics grid.
 *
 * Shows all key statistics in a two-column card grid,
 * matching the monochrome aesthetic of the rest of Tody.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { ProfileStats } from '../../types';
import { formatMinutes } from '../../utils/timeTracking';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../../utils/colors';
import { useTheme } from '../../context/ThemeContext';

interface StatsSectionProps {
  stats: ProfileStats;
}

interface StatCardData {
  label: string;
  value: string;
  icon: string;
}

export const StatsSection = memo(function StatsSection({ stats }: StatsSectionProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const cards: StatCardData[] = [
    {
      label: 'Completed',
      value: `${stats.totalCompleted}`,
      icon: 'checkmark-circle-outline',
    },
    {
      label: 'Completion Rate',
      value: `${stats.completionPercentage}%`,
      icon: 'pie-chart-outline',
    },
    {
      label: 'Current Streak',
      value: `${stats.currentStreak}d`,
      icon: 'flame-outline',
    },
    {
      label: 'Best Streak',
      value: `${stats.bestStreak}d`,
      icon: 'trophy-outline',
    },
    {
      label: 'Avg Tasks / Day',
      value: `${stats.averageTasksPerDay}`,
      icon: 'calendar-outline',
    },
    {
      label: 'Total Time',
      value: stats.totalMinutesSpent > 0 ? formatMinutes(stats.totalMinutesSpent) : '—',
      icon: 'time-outline',
    },
    {
      label: 'Avg Time / Task',
      value: stats.averageMinutesPerTask > 0 ? formatMinutes(stats.averageMinutesPerTask) : '—',
      icon: 'hourglass-outline',
    },
    {
      label: 'Best Day',
      value: stats.mostProductiveDay,
      icon: 'star-outline',
    },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(360).duration(350)}
      style={styles.container}>
      <Text style={styles.sectionTitle}>STATISTICS</Text>
      <View style={styles.grid}>
        {cards.map((card, i) => (
          <Animated.View
            key={card.label}
            entering={FadeInDown.delay(400 + i * 40).duration(300)}
            style={styles.card}>
            <View style={styles.cardIconRow}>
              <Icon name={card.icon} size={16} color={colors.textTertiary} />
            </View>
            <Text style={styles.cardValue}>{card.value}</Text>
            <Text style={styles.cardLabel}>{card.label}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Extra summary row */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {stats.totalCreated} tasks created · {stats.totalIncomplete} remaining
        </Text>
      </View>
    </Animated.View>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  card: {
    width: '48%',
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  cardIconRow: {
    marginBottom: Spacing.xs,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.3,
    fontFamily: FontFamily,
  },
  cardLabel: {
    ...Typography.small,
    color: c.textTertiary,
    marginTop: 2,
  },
  summaryRow: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  summaryText: {
    ...Typography.small,
    color: c.gray400,
  },
});
