/**
 * EstimateSuggestion Component
 * Shows pattern-based time estimate suggestions when typing task titles.
 */
import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Spacing, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { getEstimateSuggestion } from '../utils/patternLearning';
import { formatMinutes } from '../utils/timeTracking';

interface EstimateSuggestionProps {
  taskTitle: string;
  userEstimateMinutes: number | null;
}

export const EstimateSuggestion = memo(function EstimateSuggestion({
  taskTitle,
  userEstimateMinutes,
}: EstimateSuggestionProps) {
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [suggestion, setSuggestion] = useState<{
    avgMinutes: number;
    sampleSize: number;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTitleRef = useRef('');

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Reset dismissed state on title change
    if (taskTitle !== lastTitleRef.current) {
      setDismissed(false);
      lastTitleRef.current = taskTitle;
    }

    if (!taskTitle.trim() || taskTitle.trim().length < 3) {
      setSuggestion(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const result = await getEstimateSuggestion(taskTitle);
      setSuggestion(result);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [taskTitle]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!suggestion || dismissed) { return null; }

  // Build the range display (±20%)
  const lowRange = Math.round(suggestion.avgMinutes * 0.8);
  const highRange = Math.round(suggestion.avgMinutes * 1.2);
  const rangeText = `${formatMinutes(lowRange)}-${formatMinutes(highRange)}`;

  // Check if user estimate differs significantly from pattern
  const showWarning = userEstimateMinutes != null &&
    userEstimateMinutes > 0 &&
    Math.abs(userEstimateMinutes - suggestion.avgMinutes) / suggestion.avgMinutes > 0.3;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.infoText}>
          {showWarning
            ? `You estimated ${formatMinutes(userEstimateMinutes!)}, but similar tasks took ~${formatMinutes(suggestion.avgMinutes)}`
            : `Similar tasks took ${rangeText} on average`
          }
        </Text>
        <Pressable onPress={handleDismiss} hitSlop={8}>
          <Text style={styles.dismissText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: c.surface,
    padding: 8,
    marginHorizontal: Spacing.lg,
    marginTop: 4,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoText: {
    fontSize: 11,
    color: c.textTertiary,
    flex: 1,
    marginRight: Spacing.sm,
    fontFamily: FontFamily,
  },
  dismissText: {
    fontSize: 11,
    color: c.textTertiary,
    padding: 2,
    fontFamily: FontFamily,
  },
});
