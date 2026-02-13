import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../utils/colors';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export const EmptyState = memo(function EmptyState({
  title,
  subtitle,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingTop: 80,
  },
  title: {
    ...Typography.body,
    color: Colors.gray500,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
