import React, { memo } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Spacing } from '../utils/colors';

interface SectionHeaderProps {
  title: string;
  count: number;
}

export const SectionHeader = memo(function SectionHeader({
  title,
  count,
}: SectionHeaderProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.container}>
      <Text style={styles.title}>
        {title}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Colors.text,
  },
  count: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray400,
  },
});
