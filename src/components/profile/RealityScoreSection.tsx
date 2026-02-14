/**
 * RealityScoreSection – Estimation accuracy analytics as an inline profile section.
 *
 * Integrates the full Reality Score dashboard (score, insight, totals, chart)
 * directly within the Profile page. Uses the same monochrome design system.
 *
 * When there's not enough data (< 10 estimated tasks), shows a subtle
 * "unlock" prompt instead.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task } from '../../types';
import {
  calculateUserStats,
  getRecentEstimatedTasks,
  hasEnoughDataForStats,
} from '../../utils/statsCalculation';
import { formatMinutes } from '../../utils/timeTracking';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../../utils/colors';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.xxl * 2 - Spacing.lg * 2;
const CHART_HEIGHT = 120;

interface RealityScoreSectionProps {
  tasks: Task[];
}

export const RealityScoreSection = memo(function RealityScoreSection({
  tasks,
}: RealityScoreSectionProps) {
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const stats = useMemo(() => calculateUserStats(tasks), [tasks]);
  const recentTasks = useMemo(() => getRecentEstimatedTasks(tasks, 10), [tasks]);
  const hasEnoughData = useMemo(() => hasEnoughDataForStats(tasks), [tasks]);

  // Build chart data points
  const chartData = useMemo(() => {
    if (recentTasks.length < 2) return null;

    const ordered = [...recentTasks].reverse();
    const maxMinutes = Math.max(
      ...ordered.map(t => Math.max(t.estimatedMinutes || 0, t.actualMinutes || 0)),
    );
    if (maxMinutes === 0) return null;

    return ordered.map((t, i) => ({
      x: (i / (ordered.length - 1)) * CHART_WIDTH,
      estimatedY: CHART_HEIGHT - ((t.estimatedMinutes || 0) / maxMinutes) * CHART_HEIGHT,
      actualY: CHART_HEIGHT - ((t.actualMinutes || 0) / maxMinutes) * CHART_HEIGHT,
    }));
  }, [recentTasks]);

  // Score color intensity (closer to 100 = darker)
  const scoreColor = hasEnoughData && stats.realityScore >= 80
    ? colors.text
    : hasEnoughData && stats.realityScore >= 50
      ? colors.gray800
      : colors.gray600;

  return (
    <Animated.View
      entering={FadeInDown.delay(320).duration(350)}
      style={styles.outerContainer}>
      <Text style={styles.sectionTitle}>REALITY SCORE</Text>

      {!hasEnoughData ? (
        /* ── Locked / Not Enough Data ──────────────────────────────── */
        <View style={styles.lockedCard}>
          <View style={styles.lockedIconWrap}>
            <Icon name="lock-closed-outline" size={22} color={colors.gray500} />
          </View>
          <Text style={styles.lockedTitle}>Not enough data yet</Text>
          <Text style={styles.lockedSubtitle}>
            Complete {10 - stats.totalCompletedTasks} more tasks with time estimates to unlock your Reality Score.
          </Text>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, (stats.totalCompletedTasks / 10) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {stats.totalCompletedTasks} / 10 tasks
          </Text>
        </View>
      ) : (
        /* ── Full Reality Score Dashboard ──────────────────────────── */
        <>
          {/* Score Ring */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreRing}>
              <Text style={[styles.scoreNumber, { color: scoreColor }]}>
                {stats.realityScore}
              </Text>
              <Text style={styles.scorePercent}>%</Text>
            </View>
            <Text style={styles.scoreLabel}>estimate accuracy</Text>

            {/* Insight line */}
            <View style={styles.insightRow}>
              <Icon
                name={
                  stats.underestimationRate > 0
                    ? 'trending-up-outline'
                    : stats.underestimationRate < 0
                      ? 'trending-down-outline'
                      : 'checkmark-circle-outline'
                }
                size={14}
                color={colors.gray600}
              />
              <Text style={styles.insightText}>
                {stats.underestimationRate > 0
                  ? `You typically underestimate by ${stats.underestimationRate}%`
                  : stats.underestimationRate < 0
                    ? `You typically overestimate by ${Math.abs(stats.underestimationRate)}%`
                    : 'Your estimates are spot on!'}
              </Text>
            </View>
          </View>

          {/* Totals */}
          <View style={styles.totalsRow}>
            <View style={styles.totalCard}>
              <Text style={styles.totalValue}>
                {formatMinutes(stats.totalEstimatedMinutes)}
              </Text>
              <Text style={styles.totalLabel}>estimated</Text>
            </View>
            <View style={styles.totalCard}>
              <Text style={styles.totalValue}>
                {formatMinutes(stats.totalActualMinutes)}
              </Text>
              <Text style={styles.totalLabel}>actual</Text>
            </View>
          </View>

          {/* Line Chart */}
          {chartData && chartData.length >= 2 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                LAST {recentTasks.length} TASKS
              </Text>
              <View style={styles.chartContainer}>
                {/* Actual line (dark) */}
                {chartData.map((point, i) => {
                  if (i === chartData.length - 1) return null;
                  const next = chartData[i + 1];
                  const dx = next.x - point.x;
                  const dy = next.actualY - point.actualY;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  return (
                    <View
                      key={`a-${i}`}
                      style={[
                        styles.chartLine,
                        {
                          width: length,
                          left: point.x,
                          top: point.actualY,
                          transform: [{ rotate: `${angle}deg` }],
                          transformOrigin: 'left center',
                          backgroundColor: colors.text,
                        },
                      ]}
                    />
                  );
                })}
                {/* Estimated line (gray) */}
                {chartData.map((point, i) => {
                  if (i === chartData.length - 1) return null;
                  const next = chartData[i + 1];
                  const dx = next.x - point.x;
                  const dy = next.estimatedY - point.estimatedY;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  return (
                    <View
                      key={`e-${i}`}
                      style={[
                        styles.chartLine,
                        {
                          width: length,
                          left: point.x,
                          top: point.estimatedY,
                          transform: [{ rotate: `${angle}deg` }],
                          transformOrigin: 'left center',
                          backgroundColor: colors.gray400,
                        },
                      ]}
                    />
                  );
                })}
                {/* Actual dots */}
                {chartData.map((point, i) => (
                  <View
                    key={`ad-${i}`}
                    style={[
                      styles.chartDot,
                      { left: point.x - 3, top: point.actualY - 3, backgroundColor: colors.text },
                    ]}
                  />
                ))}
                {/* Estimated dots */}
                {chartData.map((point, i) => (
                  <View
                    key={`ed-${i}`}
                    style={[
                      styles.chartDot,
                      { left: point.x - 3, top: point.estimatedY - 3, backgroundColor: colors.gray400 },
                    ]}
                  />
                ))}
              </View>

              {/* Legend */}
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

          {/* Footer */}
          <Text style={styles.footerText}>
            Based on {stats.totalCompletedTasks} tasks with estimates
          </Text>
        </>
      )}
    </Animated.View>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  outerContainer: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.md,
  },

  // ── Locked State ────────────────────────────────────────────────────────
  lockedCard: {
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  lockedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    marginBottom: Spacing.xs,
    fontFamily: FontFamily,
  },
  lockedSubtitle: {
    ...Typography.caption,
    color: c.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  progressBarTrack: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    backgroundColor: c.gray200,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: c.surfaceDark,
  },
  progressLabel: {
    ...Typography.small,
    color: c.gray500,
  },

  // ── Score Card ──────────────────────────────────────────────────────────
  scoreCard: {
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  scoreRing: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    fontFamily: FontFamily,
  },
  scorePercent: {
    fontSize: 20,
    fontWeight: '600',
    color: c.gray500,
    marginTop: 8,
    fontFamily: FontFamily,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: c.gray500,
    marginBottom: Spacing.md,
    fontFamily: FontFamily,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: c.gray100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  insightText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.gray600,
    fontFamily: FontFamily,
  },

  // ── Totals ──────────────────────────────────────────────────────────────
  totalsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  totalCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.3,
    fontFamily: FontFamily,
  },
  totalLabel: {
    ...Typography.small,
    color: c.textTertiary,
    marginTop: 2,
  },

  // ── Chart ───────────────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  chartTitle: {
    ...Typography.sectionHeader,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontFamily: FontFamily,
  },
  chartContainer: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    alignSelf: 'center',
    position: 'relative',
  },
  chartLine: {
    position: 'absolute',
    height: 1.5,
  },
  chartDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
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

  // ── Footer ──────────────────────────────────────────────────────────────
  footerText: {
    ...Typography.small,
    color: c.gray400,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
