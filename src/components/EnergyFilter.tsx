import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { Layout, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Colors, Spacing, Typography } from '../utils/colors';
import { EnergyLevel } from '../types';

interface EnergyFilterProps {
  activeFilter: EnergyLevel | 'all';
  onFilterChange: (filter: EnergyLevel | 'all') => void;
  taskCount: number;
}

const FILTERS = [
  { key: 'all' as const, label: 'Overview' },
  { key: 'high' as const, label: 'Priority' },
  { key: 'medium' as const, label: 'Standard' },
  { key: 'low' as const, label: 'Backlog' },
];

export const EnergyFilter = memo(function EnergyFilter({
  activeFilter,
  onFilterChange,
  taskCount,
}: EnergyFilterProps) {
  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              onPress={() => onFilterChange(filter.key)}
              style={styles.tab}
              hitSlop={8}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {filter.label}
                </Text>
                {isActive && (
                  <Animated.View
                    layout={LinearTransition.springify().damping(20).stiffness(300)}
                    entering={ZoomIn.duration(200)}
                    style={styles.activeIndicator}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.countContainer}>
        {/* Count moved here or hidden if cleaner */}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingTop: Spacing.sm,
    // paddingBottom: Spacing.xs, // Reduced padding
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl, // Wider gap for tab feel
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  tab: {
    paddingBottom: Spacing.md,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    // position: 'relative',
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.gray400,
    letterSpacing: -0.3,
  },
  tabLabelActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -Spacing.md - 2, // Align with parent padding bottom
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.black,
    borderRadius: 1.5,
  },
  countContainer: {
    height: 1, // Minimize
  },
});
