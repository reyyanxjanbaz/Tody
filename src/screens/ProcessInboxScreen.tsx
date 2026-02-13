import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useInbox } from '../context/InboxContext';
import { useTasks } from '../context/TaskContext';
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatDeadline } from '../utils/dateUtils';
import { Priority, RootStackParamList, EnergyLevel } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProcessInbox'>;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const ENERGY_LEVELS: Array<{ value: EnergyLevel; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function ProcessInboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { inboxTasks, deleteInboxTask, removeInboxTask } = useInbox();
  const { addTask } = useTasks();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('medium');
  const [deadline, setDeadline] = useState<number | null>(null);

  // Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState(new Date());

  // Swipe animation
  const translateX = useRef(new Animated.Value(0)).current;

  const currentTask = useMemo(
    () => inboxTasks[currentIndex] ?? null,
    [inboxTasks, currentIndex],
  );

  const totalCount = inboxTasks.length;

  // Reset form when moving to a different task
  const resetForm = useCallback(() => {
    setIsExpanded(false);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setEnergyLevel('medium');
    setDeadline(null);
  }, []);

  const goToNext = useCallback(() => {
    resetForm();
    setCurrentIndex(prev => Math.min(prev, inboxTasks.length - 1));
  }, [resetForm, inboxTasks.length]);

  const goToPrev = useCallback(() => {
    resetForm();
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, [resetForm]);

  const goNext = useCallback(() => {
    resetForm();
    setCurrentIndex(prev => {
      const next = prev + 1;
      return next < inboxTasks.length ? next : prev;
    });
  }, [resetForm, inboxTasks.length]);

  // Swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left → next
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            goNext();
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right → prev
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            goToPrev();
          });
        } else {
          Animated.timing(translateX, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // Actions
  const handleMakeTask = useCallback(() => {
    if (!currentTask) return;
    if (!isExpanded) {
      setTitle(currentTask.rawText);
      setIsExpanded(true);
      return;
    }

    // Submit the processed task
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }

    addTask(trimmedTitle, {
      description,
      priority,
      energyLevel,
      deadline,
    });

    removeInboxTask(currentTask.id);
    resetForm();
    // Adjust index if needed
    setCurrentIndex(prev => {
      if (inboxTasks.length <= 1) return 0;
      return Math.min(prev, inboxTasks.length - 2);
    });
  }, [
    currentTask, isExpanded, title, description, priority,
    deadline, addTask, removeInboxTask, resetForm, inboxTasks.length,
  ]);

  const handleQuickComplete = useCallback(() => {
    if (!currentTask) return;
    // Add as completed task
    addTask(currentTask.rawText, {
      isCompleted: true,
      completedAt: Date.now(),
    });
    removeInboxTask(currentTask.id);
    resetForm();
    setCurrentIndex(prev => {
      if (inboxTasks.length <= 1) return 0;
      return Math.min(prev, inboxTasks.length - 2);
    });
  }, [currentTask, addTask, removeInboxTask, resetForm, inboxTasks.length]);

  const handleDelete = useCallback(() => {
    if (!currentTask) return;
    deleteInboxTask(currentTask.id);
    resetForm();
    setCurrentIndex(prev => {
      if (inboxTasks.length <= 1) return 0;
      return Math.min(prev, inboxTasks.length - 2);
    });
  }, [currentTask, deleteInboxTask, resetForm, inboxTasks.length]);

  const handleNext = useCallback(() => {
    goNext();
  }, [goNext]);

  // Date picker handlers
  const handleOpenDatePicker = () => {
    setTempDate(deadline ? new Date(deadline) : new Date());
    setPickerMode('date');
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        if (pickerMode === 'date') {
          setTempDate(selectedDate);
          setPickerMode('time');
          setTimeout(() => setShowDatePicker(true), 200);
        } else {
          setDeadline(selectedDate.getTime());
        }
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
        setDeadline(selectedDate.getTime());
      }
    }
  };

  const handleClearDeadline = () => {
    setDeadline(null);
    setShowDatePicker(false);
  };

  const handleConfirmDate = () => {
    setDeadline(tempDate.getTime());
    setShowDatePicker(false);
  };

  // Empty state
  if (totalCount === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Process Inbox</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Inbox is empty</Text>
          <Text style={styles.emptySubtitle}>
            Capture tasks with the + button, then come here to process them.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.progress}>
          {Math.min(currentIndex + 1, totalCount)} of {totalCount}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Task Card */}
      <Animated.View
        style={[styles.cardArea, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}>
        {currentTask ? (
          <View style={styles.card}>
            <Text style={styles.rawText}>{currentTask.rawText}</Text>
            <Text style={styles.capturedAt}>
              Captured {formatCapturedAt(currentTask.capturedAt)}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      {/* Expanded Form */}
      {isExpanded && (
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={styles.formLabel}>Title</Text>
          <TextInput
            style={styles.formInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor={Colors.gray400}
            autoCapitalize="sentences"
          />

          {/* Description */}
          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            style={[styles.formInput, styles.descriptionInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor={Colors.gray400}
            multiline
            autoCapitalize="sentences"
          />

          {/* Priority */}
          <Text style={styles.formLabel}>Priority</Text>
          <View style={styles.optionRow}>
            {PRIORITIES.map(p => (
              <Pressable
                key={p.value}
                style={[
                  styles.optionButton,
                  priority === p.value && styles.optionButtonActive,
                ]}
                onPress={() => setPriority(p.value)}>
                <Text
                  style={[
                    styles.optionText,
                    priority === p.value && styles.optionTextActive,
                  ]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Energy Level */}
          <Text style={styles.formLabel}>Energy Level</Text>
          <View style={styles.optionRow}>
            {ENERGY_LEVELS.map(e => (
              <Pressable
                key={e.value}
                style={[
                  styles.optionButton,
                  energyLevel === e.value && styles.optionButtonActive,
                ]}
                onPress={() => setEnergyLevel(e.value)}>
                <Text
                  style={[
                    styles.optionText,
                    energyLevel === e.value && styles.optionTextActive,
                  ]}>
                  {e.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Deadline */}
          <Text style={styles.formLabel}>Deadline</Text>
          <View style={styles.deadlineRow}>
            <Pressable onPress={handleOpenDatePicker} style={styles.deadlineButton}>
              <Text style={styles.deadlineButtonText}>
                {deadline ? formatDeadline(deadline) : 'Set deadline'}
              </Text>
            </Pressable>
            {deadline && (
              <Pressable onPress={handleClearDeadline} hitSlop={8}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
          </View>

          {/* Date Picker (iOS inline) */}
          {showDatePicker && Platform.OS === 'ios' && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                textColor={Colors.black}
              />
              <Pressable onPress={handleConfirmDate} style={styles.dateConfirmButton}>
                <Text style={styles.dateConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          )}

          {/* Date Picker (Android) */}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={tempDate}
              mode={pickerMode}
              display="default"
              onChange={handleDateChange}
            />
          )}
        </ScrollView>
      )}

      {/* Action Buttons */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.separator} />
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={handleMakeTask}
            hitSlop={4}>
            <Text style={styles.actionButtonTextPrimary}>
              {isExpanded ? 'Save Task' : 'Make Task'}
            </Text>
          </Pressable>

          {!isExpanded && (
            <>
              <Pressable
                style={styles.actionButton}
                onPress={handleQuickComplete}
                hitSlop={4}>
                <Text style={styles.actionButtonText}>Quick Complete</Text>
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={handleDelete}
                hitSlop={4}>
                <Text style={styles.actionButtonText}>Delete</Text>
              </Pressable>

              {currentIndex < totalCount - 1 && (
                <Pressable
                  style={styles.actionButton}
                  onPress={handleNext}
                  hitSlop={4}>
                  <Text style={styles.actionButtonText}>Next →</Text>
                </Pressable>
              )}
            </>
          )}

          {isExpanded && (
            <Pressable
              style={styles.actionButton}
              onPress={() => setIsExpanded(false)}
              hitSlop={4}>
              <Text style={styles.actionButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function formatCapturedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  progress: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '60%',
    alignItems: 'center',
  },
  rawText: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  capturedAt: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.gray500,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  formContent: {
    paddingVertical: Spacing.lg,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.gray500,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  formInput: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.text,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  optionButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionButtonActive: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  optionTextActive: {
    color: Colors.white,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  deadlineButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  deadlineButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  datePickerContainer: {
    marginTop: Spacing.sm,
  },
  dateConfirmButton: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  dateConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
  },
  actions: {
    paddingHorizontal: Spacing.lg,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
  },
  actionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
  },
});
