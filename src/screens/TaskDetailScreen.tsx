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
import { Colors, Spacing, Typography, Shadows, BorderRadius } from '../utils/colors';
import { formatDeadline } from '../utils/dateUtils';
import { formatMinutes, parseEstimateInput, getElapsedMinutes } from '../utils/timeTracking';
import { isTaskLocked, getChildren, countDescendants } from '../utils/dependencyChains';
import { Priority, RootStackParamList, EnergyLevel } from '../types';
import { EnergySelector } from '../components/EnergySelector';
import { DeadlineSnapper } from '../components/DeadlineSnapper';
import { LayoutAnimation, UIManager } from 'react-native';

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
  const { tasks, getTask, updateTask, deleteTask, deleteTaskWithCascade, completeTask, uncompleteTask, startTask, completeTimedTask, addSubtask } = useTasks();
  const task = getTask(route.params.taskId);

  // ── Local editable state ─────────────────────────────────────────────────
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'none');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(task?.energyLevel ?? 'medium');
  const [deadline, setDeadline] = useState<number | null>(task?.deadline ?? null);
  const [estimateText, setEstimateText] = useState(
    task?.estimatedMinutes ? String(task.estimatedMinutes) : '',
  );

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
      setEnergyLevel(task.energyLevel);
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

  const handleEnergyChange = (level: EnergyLevel) => {
    setEnergyLevel(level);
    updateTask(task.id, { energyLevel: level });
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
      const locked = isTaskLocked(task, tasks);
      if (locked) {
        Alert.alert('Locked', 'Complete all subtasks first.');
        return;
      }
      completeTask(task.id);
    }
  };

  const handleDelete = () => {
    const descendantCount = countDescendants(task.id, tasks);
    if (descendantCount > 0) {
      Alert.alert(
        'Delete task',
        `Delete task and ${descendantCount} subtask${descendantCount !== 1 ? 's' : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteTaskWithCascade(task.id);
              navigation.goBack();
            },
          },
        ],
      );
    } else {
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
    }
  };

  const handleAddSubtask = () => {
    if (task.depth >= 3) {
      Alert.alert('Max depth', 'Max 3 levels of subtasks');
      return;
    }
    Alert.prompt(
      'Add subtask',
      'Enter subtask title',
      (text) => {
        if (text && text.trim()) {
          addSubtask(task.id, text.trim());
        }
      },
      'plain-text',
    );
  };

  const children = useMemo(() => getChildren(task, tasks), [task, tasks]);
  const locked = useMemo(() => isTaskLocked(task, tasks), [task, tasks]);

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

        {/* Energy Level */}
        <Text style={[styles.fieldLabel, { marginTop: Spacing.xxl }]}>ENERGY LEVEL</Text>
        <View style={{ marginTop: Spacing.sm }}>
          <EnergySelector value={energyLevel} onChange={handleEnergyChange} />
        </View>

        {/* Deadline */}
        <Text style={[styles.fieldLabel, { marginTop: Spacing.xxl }]}>DEADLINE</Text>
        <DeadlineSnapper
          onSelectDeadline={(ts) => {
            setDeadline(ts);
            updateTask(task.id, { deadline: ts });
          }}
          currentDeadline={deadline}
        />
        <View style={styles.deadlineRow}>
          <Pressable style={styles.deadlineButton} onPress={handleOpenDatePicker}>
            <Text style={styles.deadlineValue}>
              {deadline ? formatDeadline(deadline) : 'Pick custom time...'}
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

        {/* Estimate */}
        <Text style={styles.fieldLabel}>ESTIMATE</Text>
        <View style={styles.deadlineRow}>
          <TextInput
            style={[styles.deadlineValue, { flex: 1, padding: 0 }]}
            value={estimateText}
            onChangeText={setEstimateText}
            onBlur={() => {
              const mins = parseEstimateInput(estimateText);
              if (mins && mins !== task.estimatedMinutes) {
                updateTask(task.id, { estimatedMinutes: mins });
                setEstimateText(String(mins));
              } else if (!estimateText.trim()) {
                updateTask(task.id, { estimatedMinutes: null });
              }
            }}
            placeholder="30 minutes"
            placeholderTextColor={Colors.gray400}
            keyboardType="default"
          />
          {estimateText ? (
            <Text style={styles.clearText}>
              {parseEstimateInput(estimateText)
                ? formatMinutes(parseEstimateInput(estimateText)!)
                : ''}
            </Text>
          ) : null}
        </View>

        {/* Timing info */}
        {task.startedAt && !task.isCompleted ? (
          <Text style={[styles.metaText, { marginTop: Spacing.md }]}>
            ● In progress — {formatMinutes(getElapsedMinutes(task.startedAt))} elapsed
          </Text>
        ) : task.actualMinutes != null && task.actualMinutes > 0 ? (
          <Text style={[styles.metaText, { marginTop: Spacing.md }]}>
            Actual time: {formatMinutes(task.actualMinutes)}
          </Text>
        ) : null}

        {/* Divider */}
        <View style={[styles.divider, { marginTop: Spacing.xxl }]} />

        {/* Subtasks section */}
        {(children.length > 0 || task.depth < 3) && (
          <>
            <Text style={styles.fieldLabel}>SUBTASKS</Text>
            {children.map(child => (
              <Pressable
                key={child.id}
                style={styles.subtaskRow}
                onPress={() => navigation.push('TaskDetail', { taskId: child.id })}>
                <View style={[styles.subtaskCheckbox, child.isCompleted && styles.subtaskCheckboxDone]}>
                  {child.isCompleted && <View style={styles.subtaskCheckboxInner} />}
                </View>
                <Text
                  style={[styles.subtaskTitle, child.isCompleted && styles.subtaskTitleDone]}
                  numberOfLines={1}>
                  {child.title}
                </Text>
              </Pressable>
            ))}
            {task.depth < 3 && (
              <Pressable style={styles.actionRow} onPress={handleAddSubtask}>
                <Text style={styles.addSubtaskText}>+ Add subtask</Text>
              </Pressable>
            )}
            {locked && (
              <Text style={styles.lockedHint}>
                🔒 Complete all subtasks to unlock this task
              </Text>
            )}
            <View style={[styles.divider, { marginTop: Spacing.md }]} />
          </>
        )}

        {/* Start/Complete Time Tracking */}
        {!task.isCompleted && !task.startedAt && (
          <Pressable
            style={styles.actionRow}
            onPress={() => startTask(task.id)}>
            <Text style={styles.actionText}>Start timer</Text>
          </Pressable>
        )}
        {!task.isCompleted && task.startedAt && (
          <Pressable
            style={styles.actionRow}
            onPress={() => completeTimedTask(task.id)}>
            <Text style={styles.actionText}>Complete (stop timer)</Text>
          </Pressable>
        )}

        {/* Complete / Restore */}
        <Pressable style={styles.actionRow} onPress={handleToggleComplete}>
          <Text style={styles.actionText}>
            {task.isCompleted ? 'Restore task' : locked ? 'Mark as done (locked)' : 'Mark as done'}
          </Text>
        </Pressable>

        {/* Parent info */}
        {task.parentId && (
          <Pressable
            style={styles.actionRow}
            onPress={() => navigation.push('TaskDetail', { taskId: task.parentId! })}>
            <Text style={[styles.metaText, { marginTop: 0 }]}>↑ Go to parent task</Text>
          </Pressable>
        )}

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
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
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
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
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
    height: 0,
    backgroundColor: 'transparent',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl,
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
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.pill,
  },
  priorityOptionActive: {
    backgroundColor: Colors.surfaceDark,
    borderColor: Colors.surfaceDark,
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
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.pill,
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
  // Subtask styles
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  subtaskCheckbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: Colors.gray400,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  subtaskCheckboxDone: {
    borderColor: Colors.surfaceDark,
    backgroundColor: Colors.surfaceDark,
  },
  subtaskCheckboxInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  subtaskTitle: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  subtaskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.gray500,
  },
  addSubtaskText: {
    ...Typography.body,
    color: Colors.gray500,
  },
  lockedHint: {
    ...Typography.small,
    color: Colors.gray400,
    marginTop: Spacing.sm,
  },
});
