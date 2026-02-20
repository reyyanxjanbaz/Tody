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
  Modal,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useInbox } from '../context/InboxContext';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { formatDeadline } from '../utils/dateUtils';
import { Priority, RootStackParamList, EnergyLevel, Task } from '../types';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProcessInbox'>;
};

type ViewMode = 'swipe' | 'grid';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const GRID_GAP = Spacing.sm;
const GRID_PADDING = Spacing.lg;

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

// Bento grid: assign column span based on text length
function getBentoSize(text: string): { colSpan: 1 | 2; minH: number } {
  const len = text.length;
  if (len > 80) return { colSpan: 2, minH: 100 };
  if (len > 40) return { colSpan: 1, minH: 100 };
  return { colSpan: 1, minH: 72 };
}

export function ProcessInboxScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { inboxTasks, captureTask, deleteInboxTask, removeInboxTask } = useInbox();
  const { addTask, addTaskLocal } = useTasks();
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('swipe');
  const [selectedGridTaskId, setSelectedGridTaskId] = useState<string | null>(null);

  // Add memo modal
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [newMemoText, setNewMemoText] = useState('');
  const addMemoInputRef = useRef<TextInput>(null);

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

  const selectedGridTask = useMemo(
    () => inboxTasks.find(t => t.id === selectedGridTaskId) ?? null,
    [inboxTasks, selectedGridTaskId],
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
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            goNext();
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
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

  // Get the active task for actions (swipe mode = currentTask, grid mode = selectedGridTask)
  const activeTask = viewMode === 'swipe' ? currentTask : selectedGridTask;

  // Actions
  const handleMakeTask = useCallback(() => {
    if (!activeTask) return;
    if (!isExpanded) {
      setTitle(activeTask.rawText);
      setIsExpanded(true);
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }

    // Capture current values for the async flow
    const taskId = activeTask.id;
    const taskPriority = priority;
    const taskEnergyLevel = energyLevel;
    const taskDeadline = deadline;
    const taskDescription = description;

    // ── Try atomic backend convert ────────────────────────────────────────────
    const doConvert = async () => {
      const { data, isBackendDown } = await api.post<{
        id: string;
        created_at: string;
      }>(`/inbox/${taskId}/convert`, {
        title: trimmedTitle,
        priority: taskPriority,
        energy_level: taskEnergyLevel,
        deadline: taskDeadline ? new Date(taskDeadline).toISOString() : undefined,
      });

      if (!isBackendDown && data) {
        // Backend atomically created the task + deleted the inbox item
        const now = Date.now();
        const newTask: Task = {
          id: data.id,
          title: trimmedTitle,
          description: taskDescription,
          priority: taskPriority,
          energyLevel: taskEnergyLevel,
          deadline: taskDeadline,
          isCompleted: false,
          completedAt: null,
          createdAt: data.created_at ? new Date(data.created_at).getTime() : now,
          updatedAt: now,
          category: 'personal',
          deferCount: 0,
          createdHour: new Date().getHours(),
          overdueStartDate: null,
          revivedAt: null,
          archivedAt: null,
          isArchived: false,
          estimatedMinutes: null,
          actualMinutes: null,
          startedAt: null,
          parentId: null,
          childIds: [],
          depth: 0,
          isRecurring: false,
          recurringFrequency: null,
          userId: user?.id,
        };
        // Add to local state (no DB sync needed — backend already persisted it)
        addTaskLocal(newTask);
        // Remove from inbox local state; DB row already deleted by backend
        removeInboxTask(taskId);
      } else {
        // ── Fallback: double-call (original behaviour) ─────────────────────────
        addTask(trimmedTitle, {
          description: taskDescription,
          priority: taskPriority,
          energyLevel: taskEnergyLevel,
          deadline: taskDeadline,
        });
        removeInboxTask(taskId);
      }

      resetForm();
      setSelectedGridTaskId(null);
      setCurrentIndex(prev => {
        if (inboxTasks.length <= 1) return 0;
        return Math.min(prev, inboxTasks.length - 2);
      });
    };

    doConvert();
  }, [
    activeTask, isExpanded, title, description, priority,
    deadline, addTask, addTaskLocal, removeInboxTask, resetForm,
    inboxTasks.length, energyLevel, user,
  ]);

  const handleQuickComplete = useCallback(() => {
    if (!activeTask) return;
    addTask(activeTask.rawText, {
      isCompleted: true,
      completedAt: Date.now(),
    });
    removeInboxTask(activeTask.id);
    resetForm();
    setSelectedGridTaskId(null);
    setCurrentIndex(prev => {
      if (inboxTasks.length <= 1) return 0;
      return Math.min(prev, inboxTasks.length - 2);
    });
  }, [activeTask, addTask, removeInboxTask, resetForm, inboxTasks.length]);

  const handleDelete = useCallback(() => {
    if (!activeTask) return;
    deleteInboxTask(activeTask.id);
    resetForm();
    setSelectedGridTaskId(null);
    setCurrentIndex(prev => {
      if (inboxTasks.length <= 1) return 0;
      return Math.min(prev, inboxTasks.length - 2);
    });
  }, [activeTask, deleteInboxTask, resetForm, inboxTasks.length]);

  // Add memo handlers
  const handleOpenAddMemo = useCallback(() => {
    setShowAddMemo(true);
    setTimeout(() => addMemoInputRef.current?.focus(), 100);
  }, []);

  const handleCloseAddMemo = useCallback(() => {
    Keyboard.dismiss();
    setShowAddMemo(false);
    setNewMemoText('');
  }, []);

  const handleSubmitMemo = useCallback(() => {
    const trimmed = newMemoText.trim();
    if (!trimmed) return;
    captureTask(trimmed);
    handleCloseAddMemo();
  }, [newMemoText, captureTask, handleCloseAddMemo]);

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

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => (prev === 'swipe' ? 'grid' : 'swipe'));
    setSelectedGridTaskId(null);
    resetForm();
  }, [resetForm]);

  // Bento grid layout calculation
  const bentoRows = useMemo(() => {
    const colWidth = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;
    const rows: Array<Array<{ task: typeof inboxTasks[0]; colSpan: 1 | 2; minH: number; width: number }>> = [];
    let currentRow: typeof rows[0] = [];
    let currentRowCols = 0;

    for (const task of inboxTasks) {
      const size = getBentoSize(task.rawText);
      if (currentRowCols + size.colSpan > 2) {
        rows.push(currentRow);
        currentRow = [];
        currentRowCols = 0;
      }
      currentRow.push({
        task,
        ...size,
        width: size.colSpan === 2 ? colWidth * 2 + GRID_GAP : colWidth,
      });
      currentRowCols += size.colSpan;
    }
    if (currentRow.length > 0) rows.push(currentRow);
    return rows;
  }, [inboxTasks]);

  // ── Add Memo Modal ──────────────────────────────────────────────
  const addMemoModal = (
    <Modal
      visible={showAddMemo}
      transparent
      animationType="fade"
      onRequestClose={handleCloseAddMemo}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalOverlayTouch} onPress={handleCloseAddMemo} />
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <TextInput
            ref={addMemoInputRef}
            style={styles.modalInput}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.gray400}
            value={newMemoText}
            onChangeText={setNewMemoText}
            onSubmitEditing={handleSubmitMemo}
            returnKeyType="done"
            autoCapitalize="sentences"
            multiline={false}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={handleCloseAddMemo} hitSlop={8} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSubmitMemo} hitSlop={8} style={styles.modalButton}>
              <Text style={[styles.modalButtonText, styles.modalSubmitText]}>Capture</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Empty state
  if (totalCount === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Icon name="chevron-back" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Memos</Text>
          <Pressable onPress={handleOpenAddMemo} hitSlop={12}>
            <Icon name="add" size={26} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="document-text-outline" size={48} color={colors.gray400} />
          <Text style={styles.emptyTitle}>No memos yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap + to capture a new thought.
          </Text>
        </View>
        {addMemoModal}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Icon name="chevron-back" size={24} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {viewMode === 'swipe'
            ? `${Math.min(currentIndex + 1, totalCount)} of ${totalCount}`
            : `${totalCount} Memo${totalCount !== 1 ? 's' : ''}`}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── Swipe View ─────────────────────────────────────────── */}
      {viewMode === 'swipe' && !isExpanded && (
        <Animated.View
          style={[styles.cardArea, { transform: [{ translateX }] }]}
          {...panResponder.panHandlers}>
          {currentTask ? (
            <View style={styles.card}>
              <View style={styles.memoBox}>
                <Text style={styles.rawText}>{currentTask.rawText}</Text>
              </View>
              <Text style={styles.capturedAt}>
                {formatCapturedAt(currentTask.capturedAt)}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      )}

      {/* ── Grid / Bento View ──────────────────────────────────── */}
      {viewMode === 'grid' && !isExpanded && (
        <ScrollView
          style={styles.gridScroll}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}>
          {bentoRows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.bentoRow}>
              {row.map(item => {
                const isSelected = selectedGridTaskId === item.task.id;
                return (
                  <Pressable
                    key={item.task.id}
                    onPress={() =>
                      setSelectedGridTaskId(
                        isSelected ? null : item.task.id,
                      )
                    }
                    style={[
                      styles.bentoCard,
                      { width: item.width, minHeight: item.minH },
                      isSelected && styles.bentoCardSelected,
                    ]}>
                    <Text
                      style={styles.bentoText}
                      numberOfLines={item.colSpan === 2 ? 6 : 4}>
                      {item.task.rawText}
                    </Text>
                    <Text style={styles.bentoCaptured}>
                      {formatCapturedAt(item.task.capturedAt)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Expanded Form */}
      {isExpanded && (
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.formLabel}>Title</Text>
          <TextInput
            style={styles.formInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor={colors.gray400}
            autoCapitalize="sentences"
          />

          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            style={[styles.formInput, styles.descriptionInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor={colors.gray400}
            multiline
            autoCapitalize="sentences"
          />

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

          {showDatePicker && Platform.OS === 'ios' && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                textColor={colors.text}
              />
              <Pressable onPress={handleConfirmDate} style={styles.dateConfirmButton}>
                <Text style={styles.dateConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          )}

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

      {/* ── Floating Controls (Dock) ───────────── */}
      {!isExpanded && (
        <View style={styles.floatingContainer}>
          <Animated.View style={styles.dockCapsule}>
            {/* Previous */}
            <Pressable
              onPress={goToPrev}
              hitSlop={12}
              disabled={viewMode !== 'swipe' || currentIndex <= 0}
              style={[
                styles.dockBtnSmall,
                (viewMode !== 'swipe' || currentIndex <= 0) && { opacity: 0.3 },
              ]}>
              <Icon name="chevron-back" size={20} color={colors.white} />
            </Pressable>

            <View style={styles.dockDivider} />

            {/* Layout Toggle */}
            <Pressable
              onPress={toggleViewMode}
              hitSlop={12}
              style={styles.dockBtnSmall}>
              <Icon
                name={viewMode === 'swipe' ? 'grid-outline' : 'albums-outline'}
                size={20}
                color={colors.white}
              />
            </Pressable>

            {/* Add Memo */}
            <Pressable
              onPress={handleOpenAddMemo}
              hitSlop={12}
              style={styles.dockBtnLarge}>
              <Icon name="add" size={24} color={colors.black} />
              <Text style={styles.dockBtnText}>New Memo</Text>
            </Pressable>

            <View style={styles.dockDivider} />

            {/* Next */}
            <Pressable
              onPress={goNext}
              hitSlop={12}
              disabled={viewMode !== 'swipe' || currentIndex >= totalCount - 1}
              style={[
                styles.dockBtnSmall,
                (viewMode !== 'swipe' || currentIndex >= totalCount - 1) && { opacity: 0.3 },
              ]}>
              <Icon name="chevron-forward" size={20} color={colors.white} />
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* ── Action Bar (icon + label, nav-bar style) ───────────── */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.separator} />
        <View style={styles.actionRow}>
          {!isExpanded ? (
            <>
              <Pressable
                style={[styles.actionBtn, !activeTask && styles.actionBtnDisabled]}
                onPress={handleMakeTask}
                disabled={!activeTask}
                hitSlop={4}>
                <Icon
                  name="arrow-redo-outline"
                  size={22}
                  color={activeTask ? colors.text : colors.gray400}
                />
                <Text style={[styles.actionLabel, activeTask && styles.actionLabelPrimary]}>
                  Make Task
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, !activeTask && styles.actionBtnDisabled]}
                onPress={handleQuickComplete}
                disabled={!activeTask}
                hitSlop={4}>
                <Icon
                  name="checkmark-circle-outline"
                  size={22}
                  color={activeTask ? colors.textSecondary : colors.gray400}
                />
                <Text style={styles.actionLabel}>Done</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, !activeTask && styles.actionBtnDisabled]}
                onPress={handleDelete}
                disabled={!activeTask}
                hitSlop={4}>
                <Icon
                  name="trash-outline"
                  size={22}
                  color={activeTask ? colors.textSecondary : colors.gray400}
                />
                <Text style={styles.actionLabel}>Delete</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={styles.actionBtn}
                onPress={handleMakeTask}
                hitSlop={4}>
                <Icon name="save-outline" size={22} color={colors.text} />
                <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Save</Text>
              </Pressable>

              <Pressable
                style={styles.actionBtn}
                onPress={() => setIsExpanded(false)}
                hitSlop={4}>
                <Icon name="close-outline" size={22} color={colors.textSecondary} />
                <Text style={styles.actionLabel}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {addMemoModal}
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.3,
    fontFamily: FontFamily,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerBtn: {
    padding: 4,
  },

  // ── Swipe card ──────────────────────────────────────────────
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '80%',
    alignItems: 'center',
  },
  memoBox: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: c.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  rawText: {
    fontSize: 20,
    fontWeight: '500',
    color: c.text,
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: FontFamily,
  },
  capturedAt: {
    fontSize: 13,
    fontWeight: '400',
    color: c.textTertiary,
    marginTop: Spacing.md,
    fontFamily: FontFamily,
  },

  // ── Grid / Bento ────────────────────────────────────────────
  gridScroll: {
    flex: 1,
  },
  gridContainer: {
    padding: GRID_PADDING,
    gap: GRID_GAP,
    paddingBottom: 120,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  bentoCard: {
    borderRadius: BorderRadius.card,
    backgroundColor: c.background,
    padding: Spacing.lg,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  bentoCardSelected: {
    borderColor: c.text,
    borderWidth: 2,
    backgroundColor: c.background,
  },
  bentoText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
    lineHeight: 20,
    fontFamily: FontFamily,
  },
  bentoCaptured: {
    fontSize: 11,
    fontWeight: '400',
    color: c.textTertiary,
    marginTop: Spacing.sm,
    fontFamily: FontFamily,
  },

  // ── Empty ───────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: c.gray500,
    textAlign: 'center',
    fontFamily: FontFamily,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: c.gray400,
    textAlign: 'center',
    fontFamily: FontFamily,
  },

  // ── Expanded form ───────────────────────────────────────────
  formContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
  },
  formContent: {
    paddingVertical: Spacing.lg,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: c.gray500,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    fontFamily: FontFamily,
  },
  formInput: {
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    backgroundColor: c.gray50,
    borderRadius: BorderRadius.input,
    fontSize: 16,
    fontWeight: '400',
    color: c.text,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
    fontFamily: FontFamily,
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
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: BorderRadius.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionButtonActive: {
    backgroundColor: c.surfaceDark,
    borderColor: c.surfaceDark,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
  optionTextActive: {
    color: c.white,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  deadlineButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: BorderRadius.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  deadlineButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textTertiary,
    fontFamily: FontFamily,
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
    color: c.black,
    fontFamily: FontFamily,
  },

  // ── Action bar (icon + label) ───────────────────────────────
  actions: {
    paddingHorizontal: Spacing.xxl,
  },
  separator: {
    height: 0,
    backgroundColor: 'transparent',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.sm,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    ...Typography.small,
    fontWeight: '600',
    color: c.textTertiary,
  },
  actionLabelPrimary: {
    color: c.text,
    fontWeight: '700',
  },

  // ── Add Memo Modal ──────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouch: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: c.background,
    borderTopLeftRadius: BorderRadius.card,
    borderTopRightRadius: BorderRadius.card,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    borderWidth: 1, borderColor: c.border,
  },
  modalInput: {
    fontSize: 17,
    fontWeight: '400',
    color: c.text,
    backgroundColor: c.gray50,
    borderRadius: BorderRadius.input,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
    fontFamily: FontFamily,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  modalButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: BorderRadius.pill,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
  modalSubmitText: {
    color: c.black,
    fontWeight: '600',
  },

  // ── Floating Dock (Capsule) ─────────────────────────────────
  floatingContainer: {
    alignItems: 'center',
    paddingBottom: Spacing.lg,
  },
  dockCapsule: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E', // Dark heavy background
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    gap: 8,
  },
  dockBtnSmall: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dockDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dockBtnLarge: {
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: c.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dockBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: c.black,
    letterSpacing: -0.3,
    fontFamily: FontFamily,
  },
});
