/**
 * Reality Score Dashboard Screen
 * Ultra-premium redesign pushing RN Reanimated & Layout boundaries.
 * Features: Staggered entry, pulsating hero score, animated side-by-side bar charts, glassmorphism-inspired cards.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTasks } from '../context/TaskContext';
import { calculateUserStats, getRecentEstimatedTasks, hasEnoughDataForStats } from '../utils/statsCalculation';
import { formatMinutes } from '../utils/timeTracking';
import { Spacing, Typography, FontFamily, BorderRadius, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types';
import { api } from '../lib/api';
import { haptic } from '../utils/haptics';

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
const CHART_HEIGHT = 200;
const MAX_BAR_HEIGHT = CHART_HEIGHT - 40;

const SPRING_CONFIG = { damping: 14, stiffness: 120, mass: 0.8 };

// ── Components ─────────────────────────────────────────────────────────────

/**
 * Animated individual bar for the chart representing either "estimated" or "actual".
 */
const AnimatedBar = ({
  value,
  max,
  color,
  index,
  delayOffset,
}: {
  value: number;
  max: number;
  color: string;
  index: number;
  delayOffset: number;
}) => {
  const heightProgress = useSharedValue(0);

  useEffect(() => {
    const finalHeight = max > 0 ? (value / max) * MAX_BAR_HEIGHT : 0;
    // ensure min height for visibility if value > 0
    const safeHeight = value > 0 ? Math.max(finalHeight, 4) : 0;
    
    heightProgress.value = withDelay(
      index * 60 + delayOffset,
      withSpring(safeHeight, SPRING_CONFIG)
    );
  }, [value, max, index, delayOffset, heightProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightProgress.value,
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, animatedStyle]} />
    </View>
  );
};

export function RealityScoreScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  // Override local styles dynamically
  const insets = useSafeAreaInsets();
  const { tasks, archivedTasks } = useTasks();

  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);
  const localStats = useMemo(() => calculateUserStats(allTasks), [allTasks]);
  const localRecentTasks = useMemo(() => getRecentEstimatedTasks(allTasks, 10), [allTasks]);
  const hasEnoughData = useMemo(() => hasEnoughDataForStats(allTasks), [allTasks]);

  const [backendData, setBackendData] = useState<BackendRealityScore | null>(null);
  const [loading, setLoading] = useState(true);

  // Background pulsing
  const pulseAnim = useSharedValue(0);
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<BackendRealityScore>('/profile/reality-score');
        if (!cancelled && data) {
          setBackendData(data);
        }
      } catch (error) {
        console.warn('Could not fetch backend score:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulseAnim]);

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
        title: r.title,
        estimatedMinutes: r.estimated_minutes,
        actualMinutes: r.actual_minutes,
      }))
    : localRecentTasks;

  const handleBack = () => {
    haptic('light');
    navigation.goBack();
  };

  const chartData = useMemo(() => {
    if (recentTasks.length === 0) return null;
    const ordered = [...recentTasks].reverse();
    const maxVal = Math.max(
      ...ordered.map(t => Math.max(t.estimatedMinutes || 0, t.actualMinutes || 0)),
    );
    return { data: ordered, maxVal: maxVal === 0 ? 1 : maxVal };
  }, [recentTasks]);

  // Derive score UI info
  const scoreColor = 
    stats.realityScore >= 85 ? '#10B981' : // Green
    stats.realityScore >= 65 ? '#F59E0B' : // Yellow
    '#EF4444'; // Red

  const scoreMessage = 
    stats.realityScore >= 85 ? 'Time Lord' :
    stats.realityScore >= 65 ? 'Getting There' :
    'Wild Guesser';

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 + pulseAnim.value * 0.05 }],
      opacity: 0.15 - pulseAnim.value * 0.1,
    };
  });

  // Dynamic Styles
  const bgStyle = { backgroundColor: c(colors).background, flex: 1 };
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface;
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border;
  const cardShadow = isDark ? 'transparent' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[bgStyle, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={16} style={styles.backBtnWrapper}>
          <Icon name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Track Activity</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={'#22C55E'} />
        </View>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        >
          {!hasEnoughData ? (
            <Animated.View entering={ZoomIn.duration(600).springify()} style={styles.noDataContainer}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.gray100 }]}>
                <Icon name="pie-chart-outline" size={48} color={'#22C55E'} />
              </View>
              <Text style={[styles.noDataTitle, { color: colors.text }]}>Data Gathering Mode</Text>
              <Text style={[styles.noDataSubtitle, { color: colors.textSecondary }]}>
                Your Reality Score requires at least 10 completed tasks with time estimates. Master your time tracking to unlock deep insights.
              </Text>
              <View style={[styles.progressBarOuter, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.gray200 }]}>
                <Animated.View 
                  entering={FadeInDown.delay(300).duration(800)}
                  style={[styles.progressBarInner, { backgroundColor: '#22C55E', width: `${(stats.totalCompletedTasks / 10) * 100}%` }]} 
                />
              </View>
              <Text style={[styles.noDataCount, { color: colors.gray400 }]}>
                {stats.totalCompletedTasks} / 10 tasks completed
              </Text>
            </Animated.View>
          ) : (
            <>
              {/* ── Hero Score Section ── */}
              <View style={styles.heroSection}>
                <Animated.View entering={ZoomIn.duration(800).springify()} style={styles.scoreContainer}>
                  {/* Pulsing ring background */}
                  <Animated.View style={[styles.pulseRing, { backgroundColor: scoreColor }, pulseStyle]} />
                  
                  <View style={[styles.scoreBubble, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', shadowColor: scoreColor }]}>
                    <Text style={[styles.scoreValue, { color: colors.text }]}>{stats.realityScore}<Text style={styles.scorePercent}>%</Text></Text>
                    <Text style={[styles.scoreSubtitle, { color: scoreColor }]}>{scoreMessage}</Text>
                  </View>
                </Animated.View>

                <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={[styles.underestimationText, { color: colors.textSecondary }]}>
                  {stats.underestimationRate > 0 ? (
                    <>You generally <Text style={{ color: '#EF4444', fontWeight: '700' }}>underestimate</Text> time by {stats.underestimationRate}%.</>
                  ) : stats.underestimationRate < 0 ? (
                    <>You generally <Text style={{ color: '#22C55E', fontWeight: '700' }}>overestimate</Text> time by {Math.abs(stats.underestimationRate)}%.</>
                  ) : (
                    <>Your time estimation is <Text style={{ color: '#22C55E', fontWeight: '700' }}>perfectly</Text> balanced!</>
                  )}
                </Animated.Text>
              </View>

              {/* ── Metric Cards ── */}
              <View style={styles.metricsRow}>
                <Animated.View 
                  entering={FadeInDown.delay(300).springify()} 
                  style={[styles.metricCard, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: cardShadow }]}
                >
                  <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(156, 163, 175, 0.15)' }]}>
                    <Icon name="time-outline" size={20} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{formatMinutes(stats.totalEstimatedMinutes)}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Estimated</Text>
                </Animated.View>

                <Animated.View 
                  entering={FadeInDown.delay(400).springify()} 
                  style={[styles.metricCard, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: cardShadow }]}
                >
                  <View style={[styles.metricIconWrap, { backgroundColor: '#22C55E20' }]}>
                    <Icon name="stopwatch-outline" size={20} color={'#22C55E'} />
                  </View>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{formatMinutes(stats.totalActualMinutes)}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Actual</Text>
                </Animated.View>
              </View>

              {/* ── Animated Chart Section ── */}
              {chartData && chartData.data.length > 0 && (
                <Animated.View 
                  entering={FadeInUp.delay(500).springify()} 
                  style={[styles.chartCard, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: cardShadow }]}
                >
                  <View style={styles.chartHeader}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>Recent Trend</Text>
                    <View style={styles.legendContainer}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
                        <Text style={[styles.legendText, { color: colors.textTertiary }]}>Est.</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                        <Text style={[styles.legendText, { color: colors.textTertiary }]}>Act.</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.chartArea}>
                    {chartData.data.map((task, index) => (
                      <View key={`chart-group-${index}`} style={styles.barGroup}>
                        <AnimatedBar 
                          value={task.estimatedMinutes ?? 0} 
                          max={chartData.maxVal} 
                          color={isDark ? 'rgba(255,255,255,0.15)' : colors.gray200}
                          index={index} 
                          delayOffset={0} 
                        />
                        <AnimatedBar 
                          value={task.actualMinutes ?? 0} 
                          max={chartData.maxVal} 
                          color={'#22C55E'} 
                          index={index} 
                          delayOffset={50} 
                        />
                      </View>
                    ))}
                  </View>
                  
                </Animated.View>
              )}

              <Animated.Text entering={FadeInDown.delay(700)} style={[styles.footerNote, { color: colors.gray400 }]}>
                Scores are refined dynamically with every tracked task. Keep pushing.
              </Animated.Text>
            </>
          )}
        </Animated.ScrollView>
      )}
    </View>
  );
}

// Minimal dummy wrapper for colors
const c = (colors: ThemeColors) => colors;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    zIndex: 10,
  },
  backBtnWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.title,
    fontFamily: FontFamily,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  // Hero section
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxxl,
    paddingTop: Spacing.xl,
  },
  scoreContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  pulseRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  scoreBubble: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '800',
    fontFamily: FontFamily,
    letterSpacing: -2,
    lineHeight: 64,
  },
  scorePercent: {
    fontSize: 24,
    color: '#888',
  },
  scoreSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  underestimationText: {
    fontSize: 15,
    fontFamily: FontFamily,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.xxxxl,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FontFamily,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily,
  },
  // Chart Section
  chartCard: {
    padding: Spacing.xl,
    borderRadius: 28,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 5,
    marginBottom: Spacing.xxxl,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily,
    letterSpacing: -0.3,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  chartArea: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 40, // headroom for bars
  },
  barGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: (CHART_WIDTH - 40) / 10, // approximate width per group
    gap: 2,
  },
  barTrack: {
    width: 6,
    height: '100%',
    justifyContent: 'flex-end',
    borderRadius: 4,
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  // No Data Area
  noDataContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  noDataTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FontFamily,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  noDataSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.md,
  },
  progressBarOuter: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 4,
  },
  noDataCount: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.md,
    fontFamily: FontFamily,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: FontFamily,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
});

