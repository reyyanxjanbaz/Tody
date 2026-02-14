import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { EnergyLevel } from '../types';

interface EnergySelectorProps {
  value: EnergyLevel;
  onChange: (value: EnergyLevel) => void;
}

export const EnergySelector = ({ value, onChange }: EnergySelectorProps) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Energy Required</Text>
      <View style={styles.buttons}>
        {(['high', 'medium', 'low'] as EnergyLevel[]).map((level) => {
          const isSelected = value === level;
          const label = level === 'high' ? 'High Focus' : level === 'medium' ? 'Medium' : 'Low Lift';
          return (
            <Pressable
              key={level}
              style={[
                styles.button,
                isSelected && styles.buttonSelected,
              ]}
              onPress={() => onChange(level)}>
              <Text
                style={[
                  styles.buttonText,
                  isSelected && styles.buttonTextSelected,
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    backgroundColor: c.white,
  },
  label: {
    ...Typography.caption,
    color: c.gray600,
    marginBottom: Spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.black,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.white,
    borderRightWidth: 1,
    borderRightColor: c.black,
  },
  buttonSelected: {
    backgroundColor: c.black,
  },
  buttonText: {
    ...Typography.caption,
    color: c.black,
    fontWeight: '400',
  },
  buttonTextSelected: {
    color: c.white,
    fontWeight: '600',
  },
});
