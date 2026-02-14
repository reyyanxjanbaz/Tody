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
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../utils/colors';
import { SPRING_SNAPPY } from '../../utils/animations';
import { useTheme } from '../../context/ThemeContext';

interface XPSectionProps {
  xp: XPData;
}

export const XPSection = memo(function XPSection({ xp }: XPSectionProps) {
  const barWidth = useSharedValue(0);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    barWidth.value = withSpring(xp.progressPercent, SPRING_SNAPPY);
  }, [xp.progressPercent, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(350)}
      style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.levelRow}>
        <View style={[styles.levelBadge, { backgroundColor: isDark ? '#F5F5F7' : Colors.surfaceDark }]}>
          <Text style={[styles.levelNumber, { color: isDark ? '#000' : Colors.white }]}>{xp.level}</Text>
        </View>
        <View style={styles.levelInfo}>
          <Text style={[styles.levelLabel, { color: colors.text }]}>Level {xp.level}</Text>
          <Text style={[styles.xpText, { color: colors.textTertiary }]}>
            {xp.xpInCurrentLevel} / {xp.xpForNextLevel} XP
          </Text>
        </View>
        <Text style={[styles.totalXP, { color: colors.textSecondary }]}>{xp.totalXP} XP</Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: isDark ? '#333' : Colors.gray200 }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: isDark ? '#F5F5F7' : Colors.surfaceDark }, barStyle]} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    ...Shadows.subtle,
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
    backgroundColor: Colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  levelNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  levelInfo: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  xpText: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  totalXP: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.surfaceDark,
  },
});
