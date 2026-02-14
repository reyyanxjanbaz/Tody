/**
 * TaskDetailScreen — Tap-to-cycle property editing.
 *
 * Replaced the old form-heavy layout with:
 *   • Title + description (editable inline)
 *   • A row of parameter pills (energy, priority, estimate, deadline)
 *     that cycle on tap — identical interaction to TaskInput
 *   • Expandable TimeQuickPick and DeadlineSnapper below the pills
 *   • Compact action buttons at the bottom
 *   • Subtask list with inline add
 *
 * No labels, no heavy sections. The value IS the control.
 */

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
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTasks } from '../context/TaskContext';
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatMinutes, getElapsedMinutes } from '../utils/timeTracking';
import { isTaskLocked, getChildren, countDescendants } from '../utils/dependencyChains';
import { Priority, RootStackParamList, EnergyLevel, Category } from '../types';
import { DeadlineSnapper } from '../components/DeadlineSnapper';
import { haptic } from '../utils/haptics';
import {
  PriorityPill,
  EnergyPill,
  EstimatePill,
  DeadlinePill,
  TimeQuickPick,
} from '../components/ParameterPills';
import { CategoryPill } from '../components/CategoryPill';
import { useTheme } from '../context/ThemeContext';


type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

export function TaskDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const {
    tasks, getTask, updateTask, deleteTask, deleteTaskWithCascade,
    completeTask, uncompleteTask, startTask, completeTimedTask, addSubtask,
    categories,
  } = useTasks();
  const task = getTask(route.params.taskId);
  const assignableCategories = useMemo(() => categories.filter(c => c.id !== 'overview'), [categories]);

  // ── Local state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'none');
  const [energy, setEnergy] = useState<EnergyLevel>(task?.energyLevel ?? 'medium');
  const [category, setCategory] = useState<string>(task?.category ?? 'personal');
  const [deadline, setDeadline] = useState<number | null>(task?.deadline ?? null);
  const [estimate, setEstimate] = useState<number | null>(task?.estimatedMinutes ?? null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  // Sync external changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setEnergy(task.energyLevel);
      setCategory(task.category ?? 'personal');
      setDeadline(task.deadline);
      setEstimate(task.estimatedMinutes ?? null);
    }
  }, [task]);

  // ── Guard ────────────────────────────────────────────────────────────────
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

  // ── Derived ──────────────────────────────────────────────────────────────
  const children = useMemo(() => getChildren(task, tasks), [task, tasks]);
  const locked = useMemo(() => isTaskLocked(task, tasks), [task, tasks]);
  const isInProgress = !!task.startedAt && !task.isCompleted;

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

  const handleEnergyChange = (e: EnergyLevel) => {
    setEnergy(e);
    updateTask(task.id, { energyLevel: e });
  };

  const handleCategoryChange = (catId: string) => {
    setCategory(catId);
    updateTask(task.id, { category: catId });
  };

  const handleEstimatePress = () => {
    setShowTimePicker(prev => !prev);
    setShowDeadlinePicker(false);
    setShowCustomDatePicker(false);
  };

  const handleEstimateChange = (mins: number | null) => {
    setEstimate(mins);
    updateTask(task.id, { estimatedMinutes: mins });
  };

  const handleDeadlinePress = () => {
    setShowDeadlinePicker(prev => !prev);
    setShowTimePicker(false);
    setShowCustomDatePicker(false);
  };

  const handleDeadlineSelect = (ts: number) => {
    setDeadline(ts);
    updateTask(task.id, { deadline: ts });
  };

  const handleClearDeadline = () => {
    setDeadline(null);
    setShowDeadlinePicker(false);
    setShowCustomDatePicker(false);
    updateTask(task.id, { deadline: null });
  };

  const handleOpenCustomDate = () => {
    setTempDate(deadline ? new Date(deadline) : new Date());
    setShowCustomDatePicker(prev => !prev);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCustomDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        const ts = selectedDate.getTime();
        setDeadline(ts);
        updateTask(task.id, { deadline: ts });
      }
    } else if (selectedDate) {
      setTempDate(selectedDate);
      const ts = selectedDate.getTime();
      setDeadline(ts);
      updateTask(task.id, { deadline: ts });
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleToggleComplete = () => {
    if (task.isCompleted) {
      uncompleteTask(task.id);
    } else {
      if (locked) {
        Alert.alert('Locked', 'Complete all subtasks first.');
        return;
      }
      haptic('success');
      completeTask(task.id);
    }
  };

  const handleDelete = () => {
    const desc = countDescendants(task.id, tasks);
    const msg = desc > 0
      ? `Delete task and ${desc} subtask${desc !== 1 ? 's' : ''}?`
      : 'This cannot be undone.';
    Alert.alert('Delete task', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          desc > 0 ? deleteTaskWithCascade(task.id) : deleteTask(task.id);
          navigation.goBack();
        },
      },
    ]);
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

  const handleBack = () => {
    if (title.trim() && title !== task.title) {
      updateTask(task.id, { title: title.trim() });
    }
    if (description !== task.description) {
      updateTask(task.id, { description });
    }
    navigation.goBack();
  };

  // ── Render ───────────────────────────────────────────────────────────────
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

        {/* ── Title ─────────────────────────────────────────────── */}
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

        {/* ── Description ───────────────────────────────────────── */}
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

        {/* ── Parameter Pills ───────────────────────────────────── */}
        <View style={[styles.pillSection, { borderTopColor: borderColor }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
            keyboardShouldPersistTaps="always">
            <EnergyPill value={energy} onChange={handleEnergyChange} />
            <PriorityPill value={priority} onChange={handlePriorityChange} />
            {assignableCategories.length > 0 && (
              <CategoryPill value={category} categories={assignableCategories} onChange={handleCategoryChange} />
            )}
            <EstimatePill value={estimate} onPress={handleEstimatePress} />
            <DeadlinePill value={deadline} onPress={handleDeadlinePress} />
          </ScrollView>

          {/* Time Quick Pick (expanded) */}
          {showTimePicker && (
            <TimeQuickPick value={estimate} onChange={handleEstimateChange} />
          )}

          {/* Deadline Snapper (expanded) */}
          {showDeadlinePicker && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <DeadlineSnapper
                onSelectDeadline={handleDeadlineSelect}
                currentDeadline={deadline}
              />
              <View style={styles.deadlineActions}>
                <Pressable
                  style={[styles.deadlinePlusBtn, showCustomDatePicker && styles.deadlinePlusBtnActive]}
                  onPress={handleOpenCustomDate}>
                  <Icon
                    name={showCustomDatePicker ? 'close' : 'add'}
                    size={16}
                    color={showCustomDatePicker ? Colors.white : Colors.gray500}
                  />
                </Pressable>
                {deadline != null && (
                  <Pressable style={styles.deadlineClearBtn} onPress={handleClearDeadline}>
                    <Icon name="close-circle" size={20} color={Colors.gray400} />
                  </Pressable>
                )}
              </View>

              {/* Custom date picker (iOS inline) */}
              {showCustomDatePicker && Platform.OS === 'ios' && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={tempDate}
                    mode="datetime"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    textColor={Colors.text}
                  />
                  <Pressable onPress={() => { setShowCustomDatePicker(false); setShowDeadlinePicker(false); }}>
                    <Text style={styles.donePickerText}>Done</Text>
                  </Pressable>
                </View>
              )}
              {showCustomDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={tempDate}
                  mode="datetime"
                  display="default"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
              )}
            </Animated.View>
          )}
        </View>

        {/* ── Timing Info ───────────────────────────────────────── */}
        {isInProgress && task.startedAt ? (
          <View style={styles.infoRow}>
            <Icon name="play-circle" size={16} color="#22C55E" />
            <Text style={styles.infoText}>
              In progress — {formatMinutes(getElapsedMinutes(task.startedAt))} elapsed
              {task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}
            </Text>
          </View>
        ) : task.isCompleted && task.actualMinutes != null && task.actualMinutes > 0 ? (
          <View style={styles.infoRow}>
            <Icon name="checkmark-circle" size={16} color={Colors.gray500} />
            <Text style={styles.infoText}>
              Took {formatMinutes(task.actualMinutes)}
              {task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}
            </Text>
          </View>
        ) : null}

        {task.deferCount > 0 && (
          <View style={styles.infoRow}>
            <Icon name="arrow-redo-outline" size={14} color={Colors.gray400} />
            <Text style={styles.infoText}>
              Deferred {task.deferCount} time{task.deferCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* ── Subtasks ──────────────────────────────────────────── */}
        {(children.length > 0 || task.depth < 3) && (
          <View style={[styles.subtaskSection, { borderTopColor: borderColor }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Subtasks</Text>
            {children.map(child => (
              <Pressable
                key={child.id}
                style={styles.subtaskRow}
                onPress={() => navigation.push('TaskDetail', { taskId: child.id })}>
                <View style={[styles.subtaskDot, child.isCompleted && styles.subtaskDotDone]} />
                <Text
                  style={[styles.subtaskTitle, { color: colors.text }, child.isCompleted && styles.subtaskTitleDone]}
                  numberOfLines={1}>
                  {child.title}
                </Text>
                <Icon name="chevron-forward" size={14} color={colors.textTertiary} />
              </Pressable>
            ))}
            {task.depth < 3 && (
              <Pressable style={styles.subtaskAdd} onPress={handleAddSubtask}>
                <Icon name="add-circle-outline" size={16} color={Colors.gray400} />
                <Text style={styles.subtaskAddText}>Add subtask</Text>
              </Pressable>
            )}
            {locked && (
              <Text style={styles.lockedHint}>
                🔒 Complete all subtasks to unlock
              </Text>
            )}
          </View>
        )}

        {/* ── Actions ───────────────────────────────────────────── */}
        <View style={[styles.actionsSection, { borderTopColor: borderColor }]}>
          {!task.isCompleted && !task.startedAt && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => { haptic('medium'); startTask(task.id); }}>
              <Icon name="play-outline" size={18} color={colors.text} />
              <Text style={[styles.actionText, { color: colors.text }]}>Start timer</Text>
            </Pressable>
          )}
          {!task.isCompleted && task.startedAt && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => { haptic('success'); completeTimedTask(task.id); }}>
              <Icon name="stop-outline" size={18} color={colors.text} />
              <Text style={[styles.actionText, { color: colors.text }]}>Complete (stop timer)</Text>
            </Pressable>
          )}
          <Pressable style={styles.actionBtn} onPress={handleToggleComplete}>
            <Icon
              name={task.isCompleted ? 'arrow-undo-outline' : 'checkmark-done-outline'}
              size={18}
              color={colors.text}
            />
            <Text style={[styles.actionText, { color: colors.text }]}>
              {task.isCompleted ? 'Restore task' : locked ? 'Mark as done (locked)' : 'Mark as done'}
            </Text>
          </Pressable>

          {task.parentId && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => navigation.push('TaskDetail', { taskId: task.parentId! })}>
              <Icon name="arrow-up-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>Go to parent task</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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
    paddingTop: Spacing.sm,
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

  // Title & Description
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Colors.text,
    minHeight: 36,
    padding: 0,
    marginBottom: Spacing.sm,
  },
  descriptionInput: {
    ...Typography.body,
    color: Colors.textSecondary,
    minHeight: 44,
    padding: 0,
    marginBottom: Spacing.lg,
  },

  // Parameter pills
  pillSection: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: Spacing.sm,
  },
  deadlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  deadlinePlusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deadlinePlusBtnActive: {
    backgroundColor: Colors.surfaceDark,
    borderColor: Colors.surfaceDark,
  },
  deadlineClearBtn: {
    padding: 4,
  },
  pickerContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  donePickerText: {
    ...Typography.link,
    color: Colors.text,
    fontWeight: '600',
    paddingVertical: Spacing.sm,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.gray500,
  },

  // Subtasks
  subtaskSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.gray500,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 4,
  },
  subtaskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.gray400,
    marginRight: Spacing.md,
  },
  subtaskDotDone: {
    borderColor: Colors.surfaceDark,
    backgroundColor: Colors.surfaceDark,
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
  subtaskAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  subtaskAddText: {
    fontSize: 15,
    color: Colors.gray400,
  },
  lockedHint: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 4,
  },

  // Actions
  actionsSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
});
