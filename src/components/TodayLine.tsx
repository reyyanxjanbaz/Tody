import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

/**
 * Feature 2: The Today Line
 * 
 * A persistent, ultra-thin horizontal line that separates
 * today's tasks from other temporal groups.
 * 1px black line, full-width, with "TODAY" label in 10pt gray (#9E9E9E)
 */
export const TodayLine = memo(function TodayLine() {
  const { colors, isDark } = useTheme();
  const lineColor = isDark ? '#555' : '#000000';
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.lineLeft, { backgroundColor: lineColor }]} />
      <View style={styles.labelContainer}>
        <Icon name="radio-button-on" size={6} color="#EF4444" style={styles.dot} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>TODAY</Text>
      </View>
      <View style={[styles.lineRight, { backgroundColor: lineColor }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  lineLeft: {
    height: 1,
    width: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  dot: {
    marginRight: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  lineRight: {
    flex: 1,
    height: 1,
  },
});
