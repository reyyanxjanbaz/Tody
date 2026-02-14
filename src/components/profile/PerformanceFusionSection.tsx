import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { ProfileStats, Task } from '../../types';
import {
  calculateUserStats,
  getRecentEstimatedTasks,
  hasEnoughDataForStats,
} from '../../utils/statsCalculation';
import { formatMinutes } from '../../utils/timeTracking';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../../utils/colors';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_PADDING = 6; // half of dot size, so edge dots aren't clipped
const CHART_WIDTH = SCREEN_WIDTH - Spacing.xxl * 2 - Spacing.lg * 2;
const CHART_DRAW_WIDTH = CHART_WIDTH - CHART_PADDING * 2;
const CHART_HEIGHT = 120;
const CHART_DRAW_HEIGHT = CHART_HEIGHT - CHART_PADDING * 2;

interface PerformanceFusionSectionProps {
  stats: ProfileStats;
  tasks: Task[];
}

export const PerformanceFusionSection = memo(function PerformanceFusionSection({
  stats,
  tasks,
}: PerformanceFusionSectionProps) {
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const realityStats = useMemo(() => calculateUserStats(tasks), [tasks]);
  const recentTasks = useMemo(() => getRecentEstimatedTasks(tasks, 10), [tasks]);
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

  const chartData = useMemo(() => {
    if (recentTasks.length < 2) return null;

    const ordered = [...recentTasks].reverse();
    const maxMinutes = Math.max(
      ...ordered.map(task => Math.max(task.estimatedMinutes || 0, task.actualMinutes || 0)),
    );
    if (maxMinutes === 0) return null;

    return ordered.map((task, index) => ({
      x: CHART_PADDING + (index / (ordered.length - 1)) * CHART_DRAW_WIDTH,
      estimatedY: CHART_PADDING + CHART_DRAW_HEIGHT - ((task.estimatedMinutes || 0) / maxMinutes) * CHART_DRAW_HEIGHT,
      actualY: CHART_PADDING + CHART_DRAW_HEIGHT - ((task.actualMinutes || 0) / maxMinutes) * CHART_DRAW_HEIGHT,
    }));
  }, [recentTasks]);

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
            <Icon name="pulse-outline" size={12} color={colors.white} />
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

      {hasRealityData && chartData && chartData.length >= 2 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>PACE GRAPH · LAST {recentTasks.length} TASKS</Text>
          <View style={styles.chartContainer}>
            {/* Actual lines (dark) */}
            {chartData.map((point, index) => {
              if (index === chartData.length - 1) return null;
              const next = chartData[index + 1];
              const dx = next.x - point.x;
              const dy = next.actualY - point.actualY;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={`a-${index}`}
                  style={{
                    position: 'absolute',
                    height: 2,
                    width: length,
                    left: point.x,
                    top: point.actualY - 1,
                    transformOrigin: 'left center',
                    transform: [{ rotate: `${angle}deg` }],
                    backgroundColor: colors.text,
                    borderRadius: 1,
                  }}
                />
              );
            })}

            {/* Estimated lines (gray) */}
            {chartData.map((point, index) => {
              if (index === chartData.length - 1) return null;
              const next = chartData[index + 1];
              const dx = next.x - point.x;
              const dy = next.estimatedY - point.estimatedY;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={`e-${index}`}
                  style={{
                    position: 'absolute',
                    height: 2,
                    width: length,
                    left: point.x,
                    top: point.estimatedY - 1,
                    transformOrigin: 'left center',
                    transform: [{ rotate: `${angle}deg` }],
                    backgroundColor: colors.gray400,
                    borderRadius: 1,
                  }}
                />
              );
            })}

            {/* Actual dots */}
            {chartData.map((point, index) => (
              <View
                key={`ad-${index}`}
                style={[
                  styles.chartDot,
                  { left: point.x - 4, top: point.actualY - 4, backgroundColor: colors.text },
                ]}
              />
            ))}

            {/* Estimated dots */}
            {chartData.map((point, index) => (
              <View
                key={`ed-${index}`}
                style={[
                  styles.chartDot,
                  { left: point.x - 4, top: point.estimatedY - 4, backgroundColor: colors.gray400 },
                ]}
              />
            ))}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.text }]} />
              <Text style={styles.legendText}>Actual</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.gray400 }]} />
              <Text style={styles.legendText}>Estimated</Text>
            </View>
          </View>
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.md,
  },
  heroCard: {
    backgroundColor: c.surfaceDark,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroEyebrow: {
    ...Typography.small,
    color: c.gray400,
    marginBottom: 2,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: c.white,
    fontFamily: FontFamily,
  },
  momentumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: c.gray800,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  momentumText: {
    ...Typography.small,
    color: c.white,
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
    borderColor: c.gray600,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  scoreNumber: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: c.white,
    lineHeight: 38,
    fontFamily: FontFamily,
  },
  scoreSuffix: {
    ...Typography.small,
    color: c.gray400,
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
    color: c.white,
    fontFamily: FontFamily,
  },
  factLabel: {
    ...Typography.small,
    color: c.gray400,
    marginTop: 2,
  },
  unlockTrack: {
    height: 5,
    borderRadius: BorderRadius.pill,
    backgroundColor: c.gray800,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  unlockFill: {
    height: '100%',
    borderRadius: BorderRadius.pill,
    backgroundColor: c.white,
  },
  narrativeText: {
    ...Typography.caption,
    color: c.gray200,
    lineHeight: 19,
  },
  alignmentCard: {
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
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
    color: c.textTertiary,
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
    color: c.textSecondary,
  },
  barValue: {
    ...Typography.caption,
    color: c.text,
    fontWeight: '600',
  },
  barTrack: {
    height: 6,
    borderRadius: BorderRadius.pill,
    backgroundColor: c.gray100,
    overflow: 'hidden',
  },
  barFillEstimated: {
    height: '100%',
    backgroundColor: c.gray500,
    borderRadius: BorderRadius.pill,
  },
  barFillActual: {
    height: '100%',
    backgroundColor: c.surfaceDark,
    borderRadius: BorderRadius.pill,
  },
  alignmentFooter: {
    ...Typography.small,
    color: c.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  chartCard: {
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  chartTitle: {
    ...Typography.sectionHeader,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  chartContainer: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    alignSelf: 'center',
    position: 'relative',
  },
  chartDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
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
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: c.gray500,
    fontFamily: FontFamily,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: '48%',
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: c.text,
    fontFamily: FontFamily,
  },
  statLabel: {
    ...Typography.small,
    color: c.textTertiary,
    marginTop: 2,
  },
});
