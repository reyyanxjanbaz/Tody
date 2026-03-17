import React, { useMemo, useState, useEffect } from 'react';
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
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types';
import { api } from '../lib/api';

type BackendRealityScore = {
  reality_score: number;
  underestimation_rate: number;
  total_estimated_minutes: number;
  total_actual_minutes: number;
  recent_tasks: Array<{
    id: string;
    title: string;
    estimated_minutes: number;
    actual_minutes: number;
    completed_at: string;
  }>;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RealityScore'>;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const CHART_HEIGHT = 160;

export function RealityScoreScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { tasks, archivedTasks } = useTasks();

  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);

  const localStats = useMemo(() => calculateUserStats(allTasks), [allTasks]);
  const localRecentTasks = useMemo(() => getRecentEstimatedTasks(allTasks, 10), [allTasks]);
  const hasEnoughData = useMemo(() => hasEnoughDataForStats(allTasks), [allTasks]);

  const [backendData, setBackendData] = useState<BackendRealityScore | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<BackendRealityScore>('/profile/reality-score');
        if (!cancelled && data) {
          setBackendData(data);
        }
      } catch (e) {
        // Silently fallback to local stats
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = backendData
    ? {
        realityScore: backendData.reality_score,
        underestimationRate: backendData.underestimation_rate,
        totalEstimatedMinutes: backendData.total_estimated_minutes,
        totalActualMinutes: backendData.total_actual_minutes,
        totalCompletedTasks: localStats.totalCompletedTasks,
      }
    : {
        realityScore: localStats.realityScore,
        underestimationRate: localStats.underestimationRate,
        totalEstimatedMinutes: localStats.totalEstimatedMinutes,
        totalActualMinutes: localStats.totalActualMinutes,
        totalCompletedTasks: localStats.totalCompletedTasks,
      };

  const recentTasks = backendData
    ? backendData.recent_tasks.slice(0, 10).map(r => ({
        estimatedMinutes: r.estimated_minutes,
        actualMinutes: r.actual_minutes,
      }))
    : localRecentTasks;

  const handleBack = () => navigation.goBack();

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
      estimated: t.estimatedMinutes || 0,
      actual: t.actualMinutes || 0,
    }));
  }, [recentTasks]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={16}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>

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
            <View style={styles.scoreSection}>
              <Text style={styles.scoreNumber}>{stats.realityScore}%</Text>
              <Text style={styles.scoreLabel}>estimate accuracy</Text>
            </View>

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

            {chartData && chartData.length >= 2 && (
              <View style={styles.chartSection}>
                <Text style={styles.chartTitle}>LAST {recentTasks.length} TASKS</Text>
                <View style={styles.chartContainer}>
                  {/* Actual line (Prominent) */}
                  {chartData.map((point, i) => {
                    if (i === chartData.length - 1) return null;
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
                            backgroundColor: styles.chartLineActual.backgroundColor,
                            zIndex: 2,
                          },
                        ]}
                      />
                    );
                  })}
                  
                  {/* Estimated line (Subtle) */}
                  {chartData.map((point, i) => {
                    if (i === chartData.length - 1) return null;
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
                            backgroundColor: styles.chartLineEstimated.backgroundColor,
                            zIndex: 1,
                          },
                        ]}
                      />
                    );
                  })}

                  {/* Actual Dots */}
                  {chartData.map((point, i) => (
                    <View
                      key={`actual-dot-${i}`}
                      style={[
                        styles.chartDot,
                        {
                          left: point.x - 3,
                          top: point.actualY - 3,
                          backgroundColor: styles.chartLineActual.backgroundColor,
                          zIndex: 2,
                        },
                      ]}
                    />
                  ))}

                  {/* Estimated Dots */}
                  {chartData.map((point, i) => (
                    <View
                      key={`estimated-dot-${i}`}
                      style={[
                        styles.chartDot,
                        {
                          left: point.x - 3,
                          top: point.estimatedY - 3,
                          backgroundColor: styles.chartLineEstimated.backgroundColor,
                          zIndex: 1,
                        },
                      ]}
                    />
                  ))}
                </View>

                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: styles.chartLineActual.backgroundColor }]} />
                    <Text style={styles.legendText}>Actual</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: styles.chartLineEstimated.backgroundColor }]} />
                    <Text style={styles.legendText}>Estimated</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={styles.taskCount}>
              Based on {stats.totalCompletedTasks} tasks with estimates
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backText: {
    ...Typography.link,
    color: c.textSecondary,
    fontFamily: FontFamily,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: -2,
    color: c.text,
    fontFamily: FontFamily,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: c.textSecondary,
    marginTop: Spacing.xs,
    fontFamily: FontFamily,
  },
  underestimationSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  underestimationText: {
    fontSize: 16,
    fontWeight: '400',
    color: c.textSecondary,
    textAlign: 'center',
    fontFamily: FontFamily,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xxxxl,
    marginBottom: Spacing.xxxl,
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '600',
    color: c.text,
    fontFamily: FontFamily,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: c.textSecondary,
    marginTop: 4,
    fontFamily: FontFamily,
  },
  chartSection: {
    marginBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.sm,
  },
  chartTitle: {
    ...Typography.sectionHeader,
    color: c.textTertiary,
    marginBottom: Spacing.xl,
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
  chartLineActual: {
    backgroundColor: c.text,
  },
  chartLineEstimated: {
    backgroundColor: isDark ? '#555555' : '#D1D5DB',
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
    marginTop: Spacing.xl,
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
    fontSize: 12,
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
  taskCount: {
    fontSize: 11,
    color: c.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontFamily: FontFamily,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: c.text,
    marginBottom: Spacing.md,
    fontFamily: FontFamily,
  },
  noDataSubtitle: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xxl,
    fontFamily: FontFamily,
  },
  noDataCount: {
    fontSize: 13,
    color: c.textTertiary,
    marginTop: Spacing.xl,
    fontFamily: FontFamily,
  },
});

