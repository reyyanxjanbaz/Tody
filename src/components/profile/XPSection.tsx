/**
 * XPSection – Level badge, XP progress bar, and numeric counters.
 *
 * The progress bar uses a spring animation that "fills up" on mount
 * for a satisfying visual effect. Monochrome palette keeps it elegant.
 */

import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { XPData } from '../../types';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../../utils/colors';
import { useTheme } from '../../context/ThemeContext';
import { SPRING_SNAPPY } from '../../utils/animations';

interface XPSectionProps {
  xp: XPData;
}

export const XPSection = memo(function XPSection({ xp }: XPSectionProps) {
  const barWidth = useSharedValue(0);
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);


  useEffect(() => {
    // Animate from 0 to actual progress on mount
    barWidth.value = withSpring(xp.progressPercent, SPRING_SNAPPY);
  }, [xp.progressPercent, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(350)}
      style={styles.container}>
      {/* Level Badge */}
      <View style={styles.levelRow}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelNumber}>{xp.level}</Text>
        </View>
        <View style={styles.levelInfo}>
          <Text style={styles.levelLabel}>Level {xp.level}</Text>
          <Text style={styles.xpText}>
            {xp.xpInCurrentLevel} / {xp.xpForNextLevel} XP
          </Text>
        </View>
        <Text style={styles.totalXP}>{xp.totalXP} XP</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, barStyle]} />
      </View>
    </Animated.View>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderLight,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  levelNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: c.white,
    fontFamily: FontFamily,
  },
  levelInfo: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    fontFamily: FontFamily,
  },
  xpText: {
    ...Typography.small,
    color: c.textTertiary,
    marginTop: 1,
  },
  totalXP: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: c.surfaceDark,
  },
});
