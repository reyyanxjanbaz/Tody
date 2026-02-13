import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

/**
 * Feature 2: The Today Line
 * 
 * A persistent, ultra-thin horizontal line that separates
 * today's tasks from other temporal groups.
 * 1px black line, full-width, with "TODAY" label in 10pt gray (#9E9E9E)
 */
export const TodayLine = memo(function TodayLine() {
  return (
    <View style={styles.container}>
      <View style={styles.lineLeft} />
      <View style={styles.labelContainer}>
        <Icon name="radio-button-on" size={6} color="#EF4444" style={styles.dot} />
        <Text style={styles.label}>TODAY</Text>
      </View>
      <View style={styles.lineRight} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  lineLeft: {
    height: 1,
    width: 12,
    backgroundColor: '#000000',
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
    color: '#9E9E9E',
  },
  lineRight: {
    flex: 1,
    height: 1,
    backgroundColor: '#000000',
  },
});
