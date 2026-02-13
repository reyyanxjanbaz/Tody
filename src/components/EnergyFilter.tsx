import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../utils/colors';
import { EnergyLevel } from '../types';

interface EnergyFilterProps {
  activeFilter: EnergyLevel | 'all';
  onFilterChange: (filter: EnergyLevel | 'all') => void;
  taskCount: number;
}

export function EnergyFilter({ activeFilter, onFilterChange, taskCount }: EnergyFilterProps) {
  const filters: (EnergyLevel | 'all')[] = ['all', 'high', 'medium', 'low'];
  
  const getLabel = (f: EnergyLevel | 'all') => {
    switch (f) {
      case 'all': return 'All';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {filters.map((filter, index) => {
          const isActive = activeFilter === filter;
          return (
            <Pressable
              key={filter}
              style={[
                styles.button, 
                isActive && styles.buttonActive,
                index < filters.length - 1 && { marginRight: 8 }
              ]}
              onPress={() => onFilterChange(filter)}
            >
              <Text style={[styles.text, isActive && styles.textActive]}>
                {getLabel(filter)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.count}>
        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  row: {
    flexDirection: 'row',
  },
  button: {
    width: 60,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 0,
  },
  buttonActive: {
    backgroundColor: Colors.black,
    borderWidth: 0,
  },
  text: {
    fontSize: 12,
    color: Colors.black,
    fontWeight: '400',
  },
  textActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  count: {
    marginTop: Spacing.sm,
    fontSize: 11,
    color: Colors.gray500,
  }
});
