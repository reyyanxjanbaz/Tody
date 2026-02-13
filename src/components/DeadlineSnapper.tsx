import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography } from '../utils/colors';

interface DeadlineSnapperProps {
  onSelectDeadline: (timestamp: number) => void;
  currentDeadline: number | null;
}

interface QuickChip {
  label: string;
  icon: string;
  iconColor: string;
  getTimestamp: () => number;
}

/**
 * Feature 1: Magnetic Deadline Snapping
 * 
 * Quick-tap deadline chips that snap to common times.
 * Small black pills on white background, 28pt height.
 * Icons use red/yellow/green to signal urgency.
 */
export const DeadlineSnapper = memo(function DeadlineSnapper({
  onSelectDeadline,
  currentDeadline,
}: DeadlineSnapperProps) {
  const chips = useMemo((): QuickChip[] => {
    const now = new Date();

    // Today at specific times
    const today9AM = new Date(now);
    today9AM.setHours(9, 0, 0, 0);

    const todayNoon = new Date(now);
    todayNoon.setHours(12, 0, 0, 0);

    const today5PM = new Date(now);
    today5PM.setHours(17, 0, 0, 0);

    const todayEOD = new Date(now);
    todayEOD.setHours(23, 59, 0, 0);

    // Tomorrow
    const tomorrow9AM = new Date(now);
    tomorrow9AM.setDate(tomorrow9AM.getDate() + 1);
    tomorrow9AM.setHours(9, 0, 0, 0);

    const tomorrow5PM = new Date(now);
    tomorrow5PM.setDate(tomorrow5PM.getDate() + 1);
    tomorrow5PM.setHours(17, 0, 0, 0);

    // Next week (Monday)
    const nextMonday = new Date(now);
    const dayOfWeek = nextMonday.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);

    // This weekend (Saturday)
    const thisSaturday = new Date(now);
    const daysUntilSaturday = (6 - thisSaturday.getDay() + 7) % 7 || 7;
    thisSaturday.setDate(thisSaturday.getDate() + daysUntilSaturday);
    thisSaturday.setHours(10, 0, 0, 0);

    const allChips: QuickChip[] = [];

    // Only show future times for today
    if (now.getHours() < 9) {
      allChips.push({
        label: 'Today 9 AM',
        icon: 'sunny-outline',
        iconColor: '#F59E0B', // amber/yellow
        getTimestamp: () => today9AM.getTime(),
      });
    }
    if (now.getHours() < 12) {
      allChips.push({
        label: 'Noon',
        icon: 'sunny',
        iconColor: '#F59E0B',
        getTimestamp: () => todayNoon.getTime(),
      });
    }
    if (now.getHours() < 17) {
      allChips.push({
        label: 'Today 5 PM',
        icon: 'time-outline',
        iconColor: '#EF4444', // red - end of workday urgency
        getTimestamp: () => today5PM.getTime(),
      });
    }

    allChips.push({
      label: 'End of Day',
      icon: 'moon-outline',
      iconColor: '#EF4444', // red - deadline pressure
      getTimestamp: () => todayEOD.getTime(),
    });

    allChips.push({
      label: 'Tomorrow 9 AM',
      icon: 'arrow-forward-circle-outline',
      iconColor: '#22C55E', // green - breathing room
      getTimestamp: () => tomorrow9AM.getTime(),
    });

    allChips.push({
      label: 'Tomorrow 5 PM',
      icon: 'arrow-forward-outline',
      iconColor: '#F59E0B',
      getTimestamp: () => tomorrow5PM.getTime(),
    });

    allChips.push({
      label: 'This Weekend',
      icon: 'cafe-outline',
      iconColor: '#22C55E',
      getTimestamp: () => thisSaturday.getTime(),
    });

    allChips.push({
      label: 'Next Monday',
      icon: 'calendar-outline',
      iconColor: '#22C55E',
      getTimestamp: () => nextMonday.getTime(),
    });

    return allChips;
  }, []);

  const handleChipPress = useCallback(
    (chip: QuickChip) => {
      onSelectDeadline(chip.getTimestamp());
    },
    [onSelectDeadline],
  );

  const isSelected = useCallback(
    (chip: QuickChip) => {
      if (!currentDeadline) return false;
      const chipTime = chip.getTimestamp();
      // Match within 1 minute tolerance
      return Math.abs(chipTime - currentDeadline) < 60000;
    },
    [currentDeadline],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>QUICK SET</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {chips.map((chip, index) => {
          const selected = isSelected(chip);
          return (
            <Pressable
              key={index}
              style={[
                styles.chip,
                selected && styles.chipSelected,
              ]}
              onPress={() => handleChipPress(chip)}
            >
              <Icon
                name={chip.icon}
                size={13}
                color={selected ? Colors.white : chip.iconColor}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                ]}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.sectionHeader,
    fontSize: 10,
    marginBottom: Spacing.sm,
    color: Colors.gray500,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: Spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: 14,
  },
  chipSelected: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  chipIcon: {
    marginRight: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.black,
  },
  chipTextSelected: {
    color: Colors.white,
  },
});
