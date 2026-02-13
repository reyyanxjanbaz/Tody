import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTasks } from '../context/TaskContext';
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatDeadline } from '../utils/dateUtils';
import { Priority, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'None' },
];

export function TaskDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { getTask, updateTask, deleteTask, completeTask, uncompleteTask } = useTasks();
  const task = getTask(route.params.taskId);

  // ── Local editable state ─────────────────────────────────────────────────
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'none');
  const [deadline, setDeadline] = useState<number | null>(task?.deadline ?? null);

  // ── Date picker state ────────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState(new Date());

  // Keep local state in sync if task changes externally
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setDeadline(task.deadline);
    }
  }, [task]);

  // Guard: task may have been deleted
  if (!task) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Task not found</Text>
        </View>
      </View>
    );
  }

  // ── Auto-save handlers ───────────────────────────────────────────────────
  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      updateTask(task.id, { title: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== task.description) {
      updateTask(task.id, { description });
    }
  };

  const handlePriorityChange = (p: Priority) => {
    setPriority(p);
    updateTask(task.id, { priority: p });
  };

  // ── Deadline picker ──────────────────────────────────────────────────────
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
          // Small delay to let Android dismiss current picker
          setTimeout(() => setShowDatePicker(true), 200);
        } else {
          // Time selected — save
          const newDeadline = selectedDate.getTime();
          setDeadline(newDeadline);
          updateTask(task.id, { deadline: newDeadline });
        }
      }
    } else {
      // iOS: picker stays visible, update live
      if (selectedDate) {
        setTempDate(selectedDate);
        const newDeadline = selectedDate.getTime();
        setDeadline(newDeadline);
        updateTask(task.id, { deadline: newDeadline });
      }
    }
  };

  const handleClearDeadline = () => {
    setDeadline(null);
    setShowDatePicker(false);
    updateTask(task.id, { deadline: null });
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleToggleComplete = () => {
    if (task.isCompleted) {
      uncompleteTask(task.id);
    } else {
      completeTask(task.id);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete task', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(task.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleBack = () => {
    // Ensure latest changes are saved
    if (title.trim() && title !== task.title) {
      updateTask(task.id, { title: title.trim() });
    }
    if (description !== task.description) {
      updateTask(task.id, { description });
    }
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled">

        {/* Title */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          onBlur={handleTitleBlur}
          placeholder="Task title"
          placeholderTextColor={Colors.gray400}
          multiline
          autoFocus={!task.title}
        />

        {/* Description */}
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          onBlur={handleDescriptionBlur}
          placeholder="Add notes..."
          placeholderTextColor={Colors.gray400}
          multiline
          textAlignVertical="top"
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Priority */}
        <Text style={styles.fieldLabel}>PRIORITY</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map(p => (
            <Pressable
              key={p.value}
              style={[
                styles.priorityOption,
                priority === p.value && styles.priorityOptionActive,
              ]}
              onPress={() => handlePriorityChange(p.value)}>
              <Text
                style={[
                  styles.priorityText,
                  priority === p.value && styles.priorityTextActive,
                ]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Deadline */}
        <Text style={[styles.fieldLabel, { marginTop: Spacing.xxl }]}>DEADLINE</Text>
        <View style={styles.deadlineRow}>
          <Pressable style={styles.deadlineButton} onPress={handleOpenDatePicker}>
            <Text style={styles.deadlineValue}>
              {deadline ? formatDeadline(deadline) : 'No deadline'}
            </Text>
          </Pressable>
          {deadline && (
            <Pressable onPress={handleClearDeadline} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* iOS inline picker */}
        {showDatePicker && Platform.OS === 'ios' && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={tempDate}
              mode="datetime"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()}
              textColor={Colors.text}
            />
            <Pressable onPress={() => setShowDatePicker(false)}>
              <Text style={styles.donePickerText}>Done</Text>
            </Pressable>
          </View>
        )}

        {/* Android dialog picker */}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={tempDate}
            mode={pickerMode}
            display="default"
            onChange={handleDateChange}
            minimumDate={pickerMode === 'date' ? new Date() : undefined}
          />
        )}

        {/* Divider */}
        <View style={[styles.divider, { marginTop: Spacing.xxl }]} />

        {/* Complete / Restore */}
        <Pressable style={styles.actionRow} onPress={handleToggleComplete}>
          <Text style={styles.actionText}>
            {task.isCompleted ? 'Restore task' : 'Mark as done'}
          </Text>
        </Pressable>

        {/* Meta info */}
        {task.deferCount > 0 && (
          <Text style={styles.metaText}>
            Deferred {task.deferCount} time{task.deferCount > 1 ? 's' : ''}
          </Text>
        )}
      </ScrollView>
    </View>
  );
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
  },
  backText: {
    ...Typography.link,
    color: Colors.textSecondary,
  },
  deleteText: {
    ...Typography.link,
    color: Colors.gray500,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Colors.text,
    minHeight: 36,
    padding: 0,
    marginBottom: Spacing.md,
  },
  descriptionInput: {
    ...Typography.body,
    color: Colors.textSecondary,
    minHeight: 60,
    padding: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.md,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  priorityOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 2,
  },
  priorityOptionActive: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  priorityText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  priorityTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  deadlineButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 2,
  },
  deadlineValue: {
    ...Typography.body,
    color: Colors.text,
  },
  clearText: {
    ...Typography.caption,
    color: Colors.gray500,
  },
  pickerContainer: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  donePickerText: {
    ...Typography.link,
    color: Colors.text,
    fontWeight: '600',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  actionRow: {
    paddingVertical: Spacing.md,
  },
  actionText: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  metaText: {
    ...Typography.small,
    color: Colors.gray400,
    marginTop: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.gray500,
  },
});
