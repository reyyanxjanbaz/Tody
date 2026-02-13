import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../utils/colors';

interface SectionHeaderProps {
  title: string;
  count: number;
}

export const SectionHeader = memo(function SectionHeader({
  title,
  count,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {title}
        <Text style={styles.count}>{`  ${count}`}</Text>
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  title: {
    ...Typography.sectionHeader,
  },
  count: {
    ...Typography.sectionHeader,
    color: Colors.gray400,
  },
});
