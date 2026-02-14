/**
 * TaskInput — Conversational task entry with smart parameter pills.
 *
 * Flow:
 *   1. User types a task title
 *   2. Pills appear below with inferred parameters (energy, priority)
 *   3. Tap any pill to cycle its value — no typing needed
 *   4. Tap the estimate pill → time quick-pick row slides in
 *   5. Tap the deadline pill → deadline snapper slides in
 *   6. Hit enter or tap ↑ to submit
 *
 * The text parser still extracts deadline/priority from keywords
 * (e.g. "urgent" → high priority, "tomorrow" → deadline).
 * Pills reflect the parsed result so the user sees what was inferred
 * and can override with a single tap.
 */

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { Priority, EnergyLevel, Category } from '../types';
import { haptic } from '../utils/haptics';
import { AnimatedPressable } from './ui';
import { DeadlineSnapper } from './DeadlineSnapper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  PriorityPill,
  EnergyPill,
  EstimatePill,
  DeadlinePill,
  TimeQuickPick,
} from './ParameterPills';
import { CategoryPill } from './CategoryPill';

// ── Props ───────────────────────────────────────────────────────────────────

export interface TaskInputParams {
  estimatedMinutes?: number;
  energyLevel?: EnergyLevel;
  priority?: Priority;
  deadline?: number | null;
  category?: string;
}

interface TaskInputProps {
  onSubmit: (text: string, params?: TaskInputParams) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Compact mode hides deadline picker for subtask entry */
  compact?: boolean;
  /** Default category for new tasks */
  defaultCategory?: string;
  /** Available categories (excluding Overview) */
  categories?: Category[];
}

// ── Smart Inference ─────────────────────────────────────────────────────────

function inferEnergy(text: string): EnergyLevel | null {
  const lower = text.toLowerCase();
  if (/write|design|plan|strategy|research|draft|architect|think/.test(lower)) return 'high';
  if (/call|email|review|check|meet|discuss|schedule/.test(lower)) return 'medium';
  if (/respond|forward|pay|buy|send|pick up|drop off/.test(lower)) return 'low';
  return null;
}

function inferPriority(text: string): Priority | null {
  const lower = text.toLowerCase();
  if (/urgent|asap|critical|important|emergency/.test(lower)) return 'high';
  if (/whenever|eventually|no rush|someday|maybe/.test(lower)) return 'low';
  return null;
}

function inferEstimate(text: string): number | null {
  const lower = text.toLowerCase();
  if (/call|email|respond|forward|send|pay/.test(lower)) return 15;
  if (/review|check|read|glance/.test(lower)) return 30;
  if (/write|draft|design|plan/.test(lower)) return 60;
  if (/research|deep dive|strategy|build/.test(lower)) return 120;
  return null;
}

// ── Component ───────────────────────────────────────────────────────────────

export const TaskInput = memo(function TaskInput({
  onSubmit,
  placeholder,
  autoFocus,
  compact = false,
  defaultCategory,
  categories: catList,
}: TaskInputProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [value, setValue] = useState('');
  const [category, setCategory] = useState(defaultCategory || 'personal');
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [priority, setPriority] = useState<Priority>('none');
  const [estimate, setEstimate] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [hasManualEnergy, setHasManualEnergy] = useState(false);

  // Sync default category when active tab changes
  useEffect(() => {
    if (defaultCategory) setCategory(defaultCategory);
  }, [defaultCategory]);
  const [hasManualPriority, setHasManualPriority] = useState(false);
  const [hasManualEstimate, setHasManualEstimate] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const showPills = value.trim().length > 0;

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleTextChange = useCallback((text: string) => {
    setValue(text);

    // Auto-infer from text (only if user hasn't manually overridden)
    if (!hasManualEnergy) {
      const e = inferEnergy(text);
      if (e) setEnergy(e);
    }
    if (!hasManualPriority) {
      const p = inferPriority(text);
      if (p) setPriority(p);
    }
    if (!hasManualEstimate) {
      const est = inferEstimate(text);
      if (est) setEstimate(est);
    }
  }, [hasManualEnergy, hasManualPriority, hasManualEstimate]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    onSubmit(trimmed, {
      energyLevel: energy,
      priority: priority !== 'none' ? priority : undefined,
      estimatedMinutes: estimate ?? undefined,
      deadline: deadline,
      category: category,
    });

    // Reset
    setValue('');
    setEnergy('medium');
    setPriority('none');
    setEstimate(null);
    setDeadline(null);
    setCategory(defaultCategory || 'personal');
    setShowTimePicker(false);
    setShowDeadlinePicker(false);
    setShowCustomDatePicker(false);
    setHasManualEnergy(false);
    setHasManualPriority(false);
    setHasManualEstimate(false);
  }, [value, energy, priority, estimate, deadline, category, defaultCategory, onSubmit]);

  const handleEnergyChange = useCallback((e: EnergyLevel) => {
    setEnergy(e);
    setHasManualEnergy(true);
  }, []);

  const handlePriorityChange = useCallback((p: Priority) => {
    setPriority(p);
    setHasManualPriority(true);
  }, []);

  const handleEstimatePress = useCallback(() => {
    setShowTimePicker(prev => !prev);
    setShowDeadlinePicker(false);
    setShowCustomDatePicker(false);
  }, []);

  const handleEstimateChange = useCallback((mins: number | null) => {
    setEstimate(mins);
    setHasManualEstimate(true);
  }, []);

  const handleDeadlinePress = useCallback(() => {
    setShowDeadlinePicker(prev => !prev);
    setShowTimePicker(false);
    setShowCustomDatePicker(false);
  }, []);

  const handleDeadlineSelect = useCallback((ts: number) => {
    setDeadline(ts);
    setShowDeadlinePicker(false);
    setShowCustomDatePicker(false);
  }, []);

  const handleCustomDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowCustomDatePicker(false);
      if (event.type === 'set' && date) {
        setDeadline(date.getTime());
      }
    } else if (date) {
      setTempDate(date);
      setDeadline(date.getTime());
    }
  }, []);

  const handleOpenCustomDate = useCallback(() => {
    haptic('selection');
    Keyboard.dismiss();
    setTempDate(deadline ? new Date(deadline) : new Date());
    setShowCustomDatePicker(prev => !prev);
  }, [deadline]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={[showPills && styles.drawer]}>
      {/* Drawer handle */}
      {showPills && (
        <View style={styles.drawerHandleRow}>
          <View style={styles.drawerHandle} />
        </View>
      )}

      {/* Text input row */}
      <View style={styles.inputRow}>
        <Icon
          name="create-outline"
          size={20}
          color={value.trim() ? colors.text : colors.gray400}
          style={styles.leadingIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder || 'What needs doing?'}
          placeholderTextColor={colors.gray400}
          value={value}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="sentences"
          autoFocus={autoFocus}
        />
        {value.trim().length > 0 && (
          <AnimatedPressable
            onPress={() => { haptic('light'); handleSubmit(); }}
            hapticStyle={null}
            pressScale={0.9}>
            <View style={styles.submitButton}>
              <Icon name="arrow-up" size={20} color={colors.white} />
            </View>
          </AnimatedPressable>
        )}
      </View>

      {/* Parameter pills */}
      {showPills && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutUp.duration(150)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillStrip}
            keyboardShouldPersistTaps="always">
            <EnergyPill value={energy} onChange={handleEnergyChange} />
            <PriorityPill value={priority} onChange={handlePriorityChange} />
            {catList && catList.length > 0 && (
              <CategoryPill value={category} categories={catList} onChange={setCategory} />
            )}
            <EstimatePill value={estimate} onPress={handleEstimatePress} />
            {!compact && (
              <DeadlinePill value={deadline} onPress={handleDeadlinePress} />
            )}
          </ScrollView>

          {/* Expanded time picker */}
          {showTimePicker && (
            <TimeQuickPick value={estimate} onChange={handleEstimateChange} onDone={() => setShowTimePicker(false)} />
          )}

          {/* Expanded deadline snapper */}
          {showDeadlinePicker && !compact && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              exiting={FadeOutUp.duration(150)}
              style={styles.deadlinePickerWrap}>
              <DeadlineSnapper
                onSelectDeadline={handleDeadlineSelect}
                currentDeadline={deadline}
              />
              <View style={styles.deadlineActionsRow}>
                <Pressable
                  style={styles.deadlinePlusBtn}
                  onPress={handleOpenCustomDate}>
                  <Icon
                    name="add"
                    size={16}
                    color={colors.gray500}
                  />
                </Pressable>
                {deadline != null && (
                  <Pressable
                    style={styles.deadlineClearBtn}
                    onPress={() => {
                      setDeadline(null);
                      setShowDeadlinePicker(false);
                      setShowCustomDatePicker(false);
                    }}>
                    <Icon name="close-circle" size={20} color={colors.gray400} />
                  </Pressable>
                )}
                <Pressable
                  style={styles.deadlineDoneBtn}
                  onPress={() => {
                    setShowDeadlinePicker(false);
                    setShowCustomDatePicker(false);
                  }}>
                  <Text style={styles.deadlineDoneText}>Done</Text>
                </Pressable>
              </View>
              {showCustomDatePicker && Platform.OS === 'ios' && (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={tempDate}
                    mode="datetime"
                    display="spinner"
                    onChange={handleCustomDateChange}
                    minimumDate={new Date()}
                    textColor={colors.text}
                    style={styles.datePicker}
                  />
                  <Pressable
                    style={styles.datePickerDoneBtn}
                    onPress={() => {
                      setShowCustomDatePicker(false);
                      setShowDeadlinePicker(false);
                    }}>
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </Pressable>
                </Animated.View>
              )}
              {showCustomDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={tempDate}
                  mode="datetime"
                  display="default"
                  onChange={handleCustomDateChange}
                  minimumDate={new Date()}
                />
              )}
            </Animated.View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
});

// ── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: BorderRadius.input,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 52,
    borderWidth: 1,
    borderColor: c.gray200,
  },
  leadingIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    ...Typography.body,
    fontSize: 16,
    color: c.text,
    fontFamily: FontFamily,
  },
  submitButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.surfaceDark,
    borderRadius: 17,
    marginLeft: Spacing.sm,
  },
  pillStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingTop: 4,
    paddingBottom: Spacing.sm,
  },
  deadlinePickerWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  deadlineActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: Spacing.sm,
  },
  deadlinePlusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.gray400,
    backgroundColor: c.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deadlinePlusBtnActive: {
    backgroundColor: c.surfaceDark,
    borderColor: c.surfaceDark,
  },
  deadlineClearBtn: {
    padding: 4,
  },
  datePickerContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  datePicker: {
    height: 180,
  },
  datePickerDoneBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: c.surfaceDark,
    fontFamily: FontFamily,
  },
  drawer: {
    backgroundColor: c.backgroundOffWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerHandleRow: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.gray200,
  },
  deadlineDoneBtn: {
    marginLeft: 'auto',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  deadlineDoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    fontFamily: FontFamily,
  },
});
