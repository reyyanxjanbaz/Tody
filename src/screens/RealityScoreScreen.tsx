/**
 * Reality Score Dashboard Screen
 * Shows estimation accuracy analytics and trends.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTasks } from '../context/TaskContext';
import { calculateUserStats, getRecentEstimatedTasks, hasEnoughDataForStats } from '../utils/statsCalculation';
import { formatMinutes } from '../utils/timeTracking';
import { Colors, Spacing, Typography } from '../utils/colors';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RealityScore'>;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.lg * 4;
const CHART_HEIGHT = 150;

export function RealityScoreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, archivedTasks } = useTasks();

  // Include archived tasks in stats calculation (prompt: "Regardless of archive status")
  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);

  const stats = useMemo(() => calculateUserStats(allTasks), [allTasks]);
  const recentTasks = useMemo(() => getRecentEstimatedTasks(allTasks, 10), [allTasks]);
  const hasEnoughData = useMemo(() => hasEnoughDataForStats(allTasks), [allTasks]);

  const handleBack = () => navigation.goBack();

  // Build simple chart data points
  const chartData = useMemo(() => {
    if (recentTasks.length < 2) { return null; }

    // Reverse so oldest is first (left to right timeline)
    const ordered = [...recentTasks].reverse();
    const maxMinutes = Math.max(
      ...ordered.map(t => Math.max(t.estimatedMinutes || 0, t.actualMinutes || 0)),
    );

    if (maxMinutes === 0) { return null; }

    return ordered.map((t, i) => ({
      x: (i / (ordered.length - 1)) * CHART_WIDTH,
      estimatedY: CHART_HEIGHT - ((t.estimatedMinutes || 0) / maxMinutes) * CHART_HEIGHT,
      actualY: CHART_HEIGHT - ((t.actualMinutes || 0) / maxMinutes) * CHART_HEIGHT,
      estimated: t.estimatedMinutes || 0,
      actual: t.actualMinutes || 0,
    }));
  }, [recentTasks]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

        {!hasEnoughData ? (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataTitle}>Not enough data yet</Text>
            <Text style={styles.noDataSubtitle}>
              Complete at least 10 tasks with time estimates to see your Reality Score.
            </Text>
            <Text style={styles.noDataCount}>
              {stats.totalCompletedTasks} of 10 tasks completed
            </Text>
          </View>
        ) : (
          <>
            {/* Reality Score */}
            <View style={styles.scoreSection}>
              <Text style={styles.scoreNumber}>{stats.realityScore}%</Text>
              <Text style={styles.scoreLabel}>estimate accuracy</Text>
            </View>

            {/* Underestimation Rate */}
            <View style={styles.underestimationSection}>
              {stats.underestimationRate > 0 ? (
                <Text style={styles.underestimationText}>
                  You typically underestimate by {stats.underestimationRate}%
                </Text>
              ) : stats.underestimationRate < 0 ? (
                <Text style={styles.underestimationText}>
                  You typically overestimate by {Math.abs(stats.underestimationRate)}%
                </Text>
              ) : (
                <Text style={styles.underestimationText}>
                  Your estimates are spot on!
                </Text>
              )}
            </View>

            {/* Totals */}
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>
                  {formatMinutes(stats.totalEstimatedMinutes)}
                </Text>
                <Text style={styles.totalLabel}>estimated</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>
                  {formatMinutes(stats.totalActualMinutes)}
                </Text>
                <Text style={styles.totalLabel}>actual</Text>
              </View>
            </View>

            {/* Simple Line Chart */}
            {chartData && chartData.length >= 2 && (
              <View style={styles.chartSection}>
                <Text style={styles.chartTitle}>LAST {recentTasks.length} TASKS</Text>
                <View style={styles.chartContainer}>
                  {/* SVG-like chart using Views */}
                  {/* Actual line (black) */}
                  {chartData.map((point, i) => {
                    if (i === chartData.length - 1) { return null; }
                    const next = chartData[i + 1];
                    const dx = next.x - point.x;
                    const dy = next.actualY - point.actualY;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    return (
                      <View
                        key={`actual-${i}`}
                        style={[
                          styles.chartLine,
                          {
                            width: length,
                            left: point.x,
                            top: point.actualY,
                            transform: [{ rotate: `${angle}deg` }],
                            transformOrigin: 'left center',
                            backgroundColor: Colors.black,
                          },
                        ]}
                      />
                    );
                  })}
                  {/* Estimated line (gray) */}
                  {chartData.map((point, i) => {
                    if (i === chartData.length - 1) { return null; }
                    const next = chartData[i + 1];
                    const dx = next.x - point.x;
                    const dy = next.estimatedY - point.estimatedY;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    return (
                      <View
                        key={`estimated-${i}`}
                        style={[
                          styles.chartLine,
                          {
                            width: length,
                            left: point.x,
                            top: point.estimatedY,
                            transform: [{ rotate: `${angle}deg` }],
                            transformOrigin: 'left center',
                            backgroundColor: Colors.gray400,
                          },
                        ]}
                      />
                    );
                  })}
                  {/* Data points - actual (black dots) */}
                  {chartData.map((point, i) => (
                    <View
                      key={`actual-dot-${i}`}
                      style={[
                        styles.chartDot,
                        {
                          left: point.x - 3,
                          top: point.actualY - 3,
                          backgroundColor: Colors.black,
                        },
                      ]}
                    />
                  ))}
                  {/* Data points - estimated (gray dots) */}
                  {chartData.map((point, i) => (
                    <View
                      key={`estimated-dot-${i}`}
                      style={[
                        styles.chartDot,
                        {
                          left: point.x - 3,
                          top: point.estimatedY - 3,
                          backgroundColor: Colors.gray400,
                        },
                      ]}
                    />
                  ))}
                </View>
                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.black }]} />
                    <Text style={styles.legendText}>Actual</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.gray400 }]} />
                    <Text style={styles.legendText}>Estimated</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Task count */}
            <Text style={styles.taskCount}>
              Based on {stats.totalCompletedTasks} tasks with estimates
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  backText: {
    ...Typography.link,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxxl,
  },
  // Score
  scoreSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    color: Colors.black,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.gray500,
    marginTop: Spacing.xs,
  },
  // Underestimation
  underestimationSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  underestimationText: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Totals
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xxxxl,
    marginBottom: Spacing.xxxxl,
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.black,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.gray500,
    marginTop: 2,
  },
  // Chart
  chartSection: {
    marginBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  chartTitle: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.lg,
    textAlign: 'center',
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
    color: Colors.gray500,
  },
  // Task count
  taskCount: {
    fontSize: 11,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  // No data state
  noDataContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxxxl,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: Spacing.md,
  },
  noDataSubtitle: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xxl,
  },
  noDataCount: {
    fontSize: 13,
    color: Colors.gray400,
    marginTop: Spacing.xl,
  },
});
