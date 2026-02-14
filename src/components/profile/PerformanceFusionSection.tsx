import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { ProfileStats, Task } from '../../types';
import {
  calculateUserStats,
  hasEnoughDataForStats,
} from '../../utils/statsCalculation';
import { formatMinutes } from '../../utils/timeTracking';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../utils/colors';

interface PerformanceFusionSectionProps {
  stats: ProfileStats;
  tasks: Task[];
}

export const PerformanceFusionSection = memo(function PerformanceFusionSection({
  stats,
  tasks,
}: PerformanceFusionSectionProps) {
  const realityStats = useMemo(() => calculateUserStats(tasks), [tasks]);
  const hasRealityData = useMemo(() => hasEnoughDataForStats(tasks), [tasks]);

  const realityProgress = Math.min(100, Math.round((realityStats.totalCompletedTasks / 10) * 100));

  const scoreTone = hasRealityData
    ? realityStats.realityScore >= 80
      ? 'Calibrated'
      : realityStats.realityScore >= 55
        ? 'Learning Curve'
        : 'Reality Drift'
    : 'Warming Up';

  const narrative = hasRealityData
    ? realityStats.underestimationRate > 0
      ? `You run optimistic by ${realityStats.underestimationRate}% on average.`
      : realityStats.underestimationRate < 0
        ? `You budget generously by ${Math.abs(realityStats.underestimationRate)}% on average.`
        : 'Your estimates are tightly aligned with reality.'
    : `Complete ${Math.max(0, 10 - realityStats.totalCompletedTasks)} more estimated tasks to unlock your full calibration score.`;

  const momentumLabel = stats.currentStreak >= 7
    ? 'Strong Rhythm'
    : stats.currentStreak >= 3
      ? 'Building Rhythm'
      : 'Early Momentum';

  const alignmentMax = Math.max(realityStats.totalEstimatedMinutes, realityStats.totalActualMinutes, 1);
  const estimatedWidth = `${Math.round((realityStats.totalEstimatedMinutes / alignmentMax) * 100)}%`;
  const actualWidth = `${Math.round((realityStats.totalActualMinutes / alignmentMax) * 100)}%`;

  const statCards = [
    { label: 'Completed', value: `${stats.totalCompleted}` },
    { label: 'Completion Rate', value: `${stats.completionPercentage}%` },
    { label: 'Current Streak', value: `${stats.currentStreak}d` },
    { label: 'Best Day', value: stats.mostProductiveDay },
    { label: 'Avg Tasks / Day', value: `${stats.averageTasksPerDay}` },
    {
      label: 'Time Invested',
      value: stats.totalMinutesSpent > 0 ? formatMinutes(stats.totalMinutesSpent) : '—',
    },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(320).duration(350)}
      style={styles.container}>
      <Text style={styles.sectionTitle}>PERFORMANCE STORY</Text>

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>Your operating pattern</Text>
            <Text style={styles.heroHeadline}>{scoreTone}</Text>
          </View>
          <View style={styles.momentumPill}>
            <Icon name="pulse-outline" size={12} color={Colors.white} />
            <Text style={styles.momentumText}>{momentumLabel}</Text>
          </View>
        </View>

        <View style={styles.heroMiddleRow}>
          <View style={styles.scoreOrbit}>
            <Text style={styles.scoreNumber}>
              {hasRealityData ? realityStats.realityScore : realityProgress}
            </Text>
            <Text style={styles.scoreSuffix}>{hasRealityData ? '%' : '% ready'}</Text>
          </View>

          <View style={styles.heroFacts}>
            <View style={styles.factItem}>
              <Text style={styles.factValue}>{stats.totalCreated}</Text>
              <Text style={styles.factLabel}>created</Text>
            </View>
            <View style={styles.factItem}>
              <Text style={styles.factValue}>{stats.totalIncomplete}</Text>
              <Text style={styles.factLabel}>open</Text>
            </View>
            <View style={styles.factItem}>
              <Text style={styles.factValue}>{stats.bestStreak}d</Text>
              <Text style={styles.factLabel}>record</Text>
            </View>
          </View>
        </View>

        {!hasRealityData && (
          <View style={styles.unlockTrack}>
            <View style={[styles.unlockFill, { width: `${realityProgress}%` }]} />
          </View>
        )}

        <Text style={styles.narrativeText}>{narrative}</Text>
      </View>

      {hasRealityData && (
        <View style={styles.alignmentCard}>
          <View style={styles.alignmentHeader}>
            <Text style={styles.alignmentTitle}>ESTIMATE VS REALITY</Text>
            <Text style={styles.alignmentSubtitle}>Your time calibration footprint</Text>
          </View>

          <View style={styles.barBlock}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Estimated</Text>
              <Text style={styles.barValue}>{formatMinutes(realityStats.totalEstimatedMinutes)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFillEstimated, { width: estimatedWidth }]} />
            </View>
          </View>

          <View style={styles.barBlock}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Actual</Text>
              <Text style={styles.barValue}>{formatMinutes(realityStats.totalActualMinutes)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFillActual, { width: actualWidth }]} />
            </View>
          </View>

          <Text style={styles.alignmentFooter}>
            Based on {realityStats.totalCompletedTasks} tasks with time estimates
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        {statCards.map((card, index) => (
          <Animated.View
            key={card.label}
            entering={FadeInDown.delay(420 + index * 35).duration(280)}
            style={styles.statCard}>
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.md,
  },
  heroCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroEyebrow: {
    ...Typography.small,
    color: Colors.gray400,
    marginBottom: 2,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Colors.white,
  },
  momentumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.gray800,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  momentumText: {
    ...Typography.small,
    color: Colors.white,
  },
  heroMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  scoreOrbit: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: Colors.gray600,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  scoreNumber: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.white,
    lineHeight: 38,
  },
  scoreSuffix: {
    ...Typography.small,
    color: Colors.gray400,
    marginTop: -2,
  },
  heroFacts: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  factItem: {
    alignItems: 'center',
  },
  factValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Colors.white,
  },
  factLabel: {
    ...Typography.small,
    color: Colors.gray400,
    marginTop: 2,
  },
  unlockTrack: {
    height: 5,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.gray800,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  unlockFill: {
    height: '100%',
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.white,
  },
  narrativeText: {
    ...Typography.caption,
    color: Colors.gray200,
    lineHeight: 19,
  },
  alignmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.subtle,
  },
  alignmentHeader: {
    marginBottom: Spacing.md,
  },
  alignmentTitle: {
    ...Typography.sectionHeader,
    marginBottom: 2,
  },
  alignmentSubtitle: {
    ...Typography.small,
    color: Colors.textTertiary,
  },
  barBlock: {
    marginBottom: Spacing.md,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  barLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  barValue: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
  },
  barTrack: {
    height: 6,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.gray100,
    overflow: 'hidden',
  },
  barFillEstimated: {
    height: '100%',
    backgroundColor: Colors.gray500,
    borderRadius: BorderRadius.pill,
  },
  barFillActual: {
    height: '100%',
    backgroundColor: Colors.surfaceDark,
    borderRadius: BorderRadius.pill,
  },
  alignmentFooter: {
    ...Typography.small,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    ...Shadows.subtle,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Colors.text,
  },
  statLabel: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
