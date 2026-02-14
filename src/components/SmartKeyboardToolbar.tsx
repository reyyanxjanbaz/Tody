import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { Priority, EnergyLevel } from '../types';

type ToolbarMode = 'title' | 'deadline' | 'description' | 'estimate';

interface SmartKeyboardToolbarProps {
  mode: ToolbarMode;
  visible: boolean;
  // Title mode handlers
  onInsertPriority?: (priority: Priority) => void;
  onInsertEnergy?: (energy: EnergyLevel) => void;
  // Deadline mode handlers
  onAddTime?: (minutes: number) => void;
  // Description mode handlers
  onInsertBullet?: () => void;
  onInsertNumberedList?: () => void;
  onInsertLineBreak?: () => void;
}

interface ToolbarButton {
  label: string;
  icon: string;
  iconColor: string;
  onPress: () => void;
}

/**
 * Feature 5: Smart Keyboard Toolbar
 * 
 * 44pt height, white background, 1px top border,
 * text-only black buttons, 44x44pt touch targets.
 * Context-aware based on which field is focused.
 */
export const SmartKeyboardToolbar = memo(function SmartKeyboardToolbar({
  mode,
  visible,
  onInsertPriority,
  onInsertEnergy,
  onAddTime,
  onInsertBullet,
  onInsertNumberedList,
  onInsertLineBreak,
}: SmartKeyboardToolbarProps) {
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const buttons = useMemo((): ToolbarButton[] => {
    switch (mode) {
      case 'title':
        return [
          { label: '!!! High', icon: 'flag', iconColor: '#EF4444', onPress: () => onInsertPriority?.('high') },
          { label: '!! Med', icon: 'flag-outline', iconColor: '#F59E0B', onPress: () => onInsertPriority?.('medium') },
          { label: '! Low', icon: 'flag-outline', iconColor: '#22C55E', onPress: () => onInsertPriority?.('low') },
          { label: '⚡ High', icon: 'flash', iconColor: '#EF4444', onPress: () => onInsertEnergy?.('high') },
          { label: '⚡ Med', icon: 'flash-outline', iconColor: '#F59E0B', onPress: () => onInsertEnergy?.('medium') },
          { label: '⚡ Low', icon: 'flash-outline', iconColor: '#22C55E', onPress: () => onInsertEnergy?.('low') },
        ];
      case 'deadline':
      case 'estimate':
        return [
          { label: '+1hr', icon: 'time-outline', iconColor: colors.gray600, onPress: () => onAddTime?.(60) },
          { label: '+3hr', icon: 'time-outline', iconColor: colors.gray600, onPress: () => onAddTime?.(180) },
          { label: '+1day', icon: 'today-outline', iconColor: '#F59E0B', onPress: () => onAddTime?.(1440) },
          { label: '+3days', icon: 'calendar-outline', iconColor: '#F59E0B', onPress: () => onAddTime?.(4320) },
          { label: '+1week', icon: 'calendar-outline', iconColor: '#22C55E', onPress: () => onAddTime?.(10080) },
        ];
      case 'description':
        return [
          { label: '• Bullet', icon: 'list-outline', iconColor: colors.gray600, onPress: () => onInsertBullet?.() },
          { label: '1. List', icon: 'reorder-four-outline', iconColor: colors.gray600, onPress: () => onInsertNumberedList?.() },
          { label: '↵ Break', icon: 'return-down-back-outline', iconColor: colors.gray600, onPress: () => onInsertLineBreak?.() },
        ];
      default:
        return [];
    }
  }, [mode, onInsertPriority, onInsertEnergy, onAddTime, onInsertBullet, onInsertNumberedList, onInsertLineBreak]);

  if (!visible) return null;
  if (buttons.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {buttons.map((button, index) => (
          <Pressable
            key={index}
            style={styles.button}
            onPress={button.onPress}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Icon name={button.icon} size={14} color={button.iconColor} />
            <Text style={styles.buttonText}>{button.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    height: 44,
    backgroundColor: c.white,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    justifyContent: 'center',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 10,
    backgroundColor: c.gray50,
    borderRadius: 6,
    gap: 4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.black,
    fontFamily: FontFamily,
  },
});
