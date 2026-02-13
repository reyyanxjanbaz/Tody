import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../utils/colors';
import { EnergyLevel } from '../types';

interface EnergySelectorProps {
  value: EnergyLevel;
  onChange: (value: EnergyLevel) => void;
}

export const EnergySelector = ({ value, onChange }: EnergySelectorProps) => {
  return (
    <View style={selectorStyles.container}>
      <Text style={selectorStyles.label}>Energy Required</Text>
      <View style={selectorStyles.buttons}>
        {(['high', 'medium', 'low'] as EnergyLevel[]).map((level) => {
          const isSelected = value === level;
          const label = level === 'high' ? 'High Focus' : level === 'medium' ? 'Medium' : 'Low Lift';
          return (
            <Pressable
              key={level}
              style={[
                selectorStyles.button,
                isSelected && selectorStyles.buttonSelected,
              ]}
              onPress={() => onChange(level)}>
              <Text
                style={[
                  selectorStyles.buttonText,
                  isSelected && selectorStyles.buttonTextSelected,
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const selectorStyles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    // borderBottomWidth: StyleSheet.hairlineWidth, // Removed border as it might be used in different contexts
    // borderBottomColor: Colors.borderLight,
  },
  label: {
    ...Typography.caption,
    color: Colors.gray600,
    marginBottom: Spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.black,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRightWidth: 1,
    borderRightColor: Colors.black,
  },
  buttonSelected: {
    backgroundColor: Colors.black,
  },
  buttonText: {
    ...Typography.caption,
    color: Colors.black,
    fontWeight: '400',
  },
  buttonTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
});
