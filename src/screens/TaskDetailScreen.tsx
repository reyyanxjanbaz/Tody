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
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTasks } from '../context/TaskContext';
import { Spacing, Typography, FontFamily, BorderRadius, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes, getElapsedMinutes } from '../utils/timeTracking';
import { isTaskLocked, getChildren, countDescendants } from '../utils/dependencyChains';
import { Priority, RootStackParamList, EnergyLevel } from '../types';
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
import { PromptModal } from '../components/ui';


type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

export function TaskDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
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
  const [subtaskPromptVisible, setSubtaskPromptVisible] = useState(false);

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
    Keyboard.dismiss();
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Add subtask',
        'Enter subtask title',
        (text) => {
          if (text && text.trim()) {
            const created = addSubtask(task.id, text.trim());
            if (!created) {
              Alert.alert('Could not add subtask', 'Please try again.');
            }
          }
        },
        'plain-text',
      );
    } else {
      setTimeout(() => setSubtaskPromptVisible(true), 80);
    }
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

  const handleDone = () => {
    if (title.trim() && title !== task.title) {
      updateTask(task.id, { title: title.trim() });
    }
    if (description !== task.description) {
      updateTask(task.id, { description });
    }
    navigation.navigate('Home');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        keyboardShouldPersistTaps="always">

        {/* ── Title ─────────────────────────────────────────────── */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          onBlur={handleTitleBlur}
          placeholder="Task title"
          placeholderTextColor={colors.gray400}
          multiline
          autoFocus={!task.title}
        />

        {/* ── Description (sticky-note style) ───────────────── */}
        <View style={styles.stickyNote}>
          <View style={styles.stickyNoteHeader}>
            <Icon name="document-text-outline" size={14} color={colors.gray400} />
            <Text style={styles.stickyNoteLabel}>Notes</Text>
          </View>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            onBlur={handleDescriptionBlur}
            placeholder="Add notes..."
            placeholderTextColor={colors.gray400}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* ── Parameter Pills ───────────────────────────────────── */}
        <View style={styles.pillSection}>
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
            <TimeQuickPick value={estimate} onChange={handleEstimateChange} onDone={() => setShowTimePicker(false)} />
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
                    color={showCustomDatePicker ? colors.white : colors.gray500}
                  />
                </Pressable>
                <Pressable
                  style={styles.deadlineDoneBtn}
                  onPress={() => { setShowDeadlinePicker(false); setShowCustomDatePicker(false); }}>
                  <Text style={styles.deadlineDoneText}>Done</Text>
                </Pressable>
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
                    textColor={colors.text}
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
            <Icon name="checkmark-circle" size={16} color={colors.gray500} />
            <Text style={styles.infoText}>
              Took {formatMinutes(task.actualMinutes)}
              {task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}
            </Text>
          </View>
        ) : null}

        {task.deferCount > 0 && (
          <View style={styles.infoRow}>
            <Icon name="arrow-redo-outline" size={14} color={colors.gray400} />
            <Text style={styles.infoText}>
              Deferred {task.deferCount} time{task.deferCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* ── Subtasks ──────────────────────────────────────────── */}
        {(children.length > 0 || task.depth < 3) && (
          <View style={styles.subtaskSection}>
            <Text style={styles.sectionLabel}>Subtasks</Text>
            {children.map(child => (
              <Pressable
                key={child.id}
                style={styles.subtaskRow}
                onPress={() => navigation.push('TaskDetail', { taskId: child.id })}>
                <View style={[styles.subtaskDot, child.isCompleted && styles.subtaskDotDone]} />
                <Text
                  style={[styles.subtaskTitle, child.isCompleted && styles.subtaskTitleDone]}
                  numberOfLines={1}>
                  {child.title}
                </Text>
                <Icon name="chevron-forward" size={14} color={colors.gray400} />
              </Pressable>
            ))}
            {task.depth < 3 && (
              <Pressable style={styles.subtaskAdd} onPress={handleAddSubtask}>
                <Icon name="add-circle-outline" size={16} color={colors.gray400} />
                <Text style={styles.subtaskAddText}>Add subtask</Text>
              </Pressable>
            )}
            {locked && (
              <View style={styles.lockedHintRow}>
                <Icon name="lock-closed" size={13} color={colors.gray400} />
                <Text style={styles.lockedHint}>
                  Complete all subtasks to unlock
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Actions ───────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          {!task.isCompleted && !task.startedAt && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => { haptic('medium'); startTask(task.id); }}>
              <Icon name="play-outline" size={18} color={colors.text} />
              <Text style={styles.actionText}>Start timer</Text>
            </Pressable>
          )}
          {!task.isCompleted && task.startedAt && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => { haptic('success'); completeTimedTask(task.id); }}>
              <Icon name="stop-outline" size={18} color={colors.text} />
              <Text style={styles.actionText}>Complete (stop timer)</Text>
            </Pressable>
          )}
          <Pressable style={styles.actionBtn} onPress={handleToggleComplete}>
            <Icon
              name={task.isCompleted ? 'arrow-undo-outline' : 'checkmark-done-outline'}
              size={18}
              color={colors.text}
            />
            <Text style={styles.actionText}>
              {task.isCompleted ? 'Restore task' : locked ? 'Mark as done (locked)' : 'Mark as done'}
            </Text>
          </Pressable>

          {task.parentId && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => navigation.push('TaskDetail', { taskId: task.parentId! })}>
              <Icon name="arrow-up-outline" size={18} color={colors.gray500} />
              <Text style={[styles.actionText, { color: colors.gray500 }]}>Go to parent task</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          style={styles.bottomButtons}
          onPress={handleDone}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.bottomButtons}
          onPress={handleDelete}>
          <Icon name="trash-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Android subtask prompt */}
      <PromptModal
        visible={subtaskPromptVisible}
        title="Add subtask"
        message="Enter subtask title"
        onSubmit={(text) => {
          const trimmed = text.trim();
          if (!trimmed) {
            setSubtaskPromptVisible(false);
            return;
          }
          const created = addSubtask(task.id, trimmed);
          setSubtaskPromptVisible(false);
          if (!created) {
            Alert.alert('Could not add subtask', 'Please try again.');
          }
        }}
        onCancel={() => setSubtaskPromptVisible(false)}
        submitLabel="Add"
      />
    </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  backText: {
    ...Typography.link,
    color: c.textSecondary,
  },
  doneText: {
    ...Typography.link,
    color: c.text,
    fontWeight: '600',
  },
  deleteText: {
    ...Typography.link,
    color: c.gray500,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.sm,
  },

  // Bottom Action Bar
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
    flexShrink: 0,
  },
  bottomButtons: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: c.gray500,
  },

  // Title & Description
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: c.text,
    minHeight: 36,
    padding: 0,
    marginBottom: Spacing.sm,
    fontFamily: FontFamily,
  },
  descriptionInput: {
    ...Typography.body,
    color: c.textSecondary,
    minHeight: 120,
    padding: 0,
    paddingTop: 0,
    lineHeight: 24,
  },
  stickyNote: {
    backgroundColor: c.gray50,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: c.gray200,
    minHeight: 140,
  },
  stickyNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  stickyNoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.gray400,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: FontFamily,
  },

  // Parameter pills
  pillSection: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
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
    borderColor: c.gray200,
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
  pickerContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  donePickerText: {
    ...Typography.link,
    color: c.text,
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
    color: c.gray500,
    fontFamily: FontFamily,
  },

  // Subtasks
  subtaskSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: c.gray500,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    fontFamily: FontFamily,
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
    borderColor: c.gray400,
    marginRight: Spacing.md,
  },
  subtaskDotDone: {
    borderColor: c.surfaceDark,
    backgroundColor: c.surfaceDark,
  },
  subtaskTitle: {
    ...Typography.body,
    color: c.text,
    flex: 1,
  },
  subtaskTitleDone: {
    textDecorationLine: 'line-through',
    color: c.gray500,
  },
  subtaskAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  subtaskAddText: {
    fontSize: 15,
    color: c.gray400,
    fontFamily: FontFamily,
  },
  lockedHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  lockedHint: {
    fontSize: 12,
    color: c.gray400,
    fontFamily: FontFamily,
  },

  // Actions
  actionsSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
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
    color: c.text,
    fontFamily: FontFamily,
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
