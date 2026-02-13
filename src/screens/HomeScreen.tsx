import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTasks } from '../context/TaskContext';
import { TaskInput } from '../components/TaskInput';
import { TaskItem } from '../components/TaskItem';
import { EnergyFilter } from '../components/EnergyFilter';
import { SectionHeader } from '../components/SectionHeader';
import { EmptyState } from '../components/EmptyState';
import { QuickCaptureFAB } from '../components/QuickCaptureFAB';
import { InboxBadge } from '../components/InboxBadge';
import { TaskContextMenu } from '../components/TaskContextMenu';
import { organizeTasks, searchTasks } from '../utils/taskIntelligence';
import { isFullyDecayed } from '../utils/decay';
import { isTaskLocked, countDescendants, flattenTasksHierarchically } from '../utils/dependencyChains';
import { Colors, Spacing, Typography } from '../utils/colors';
import { Task, RootStackParamList, EnergyLevel } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, addTask, addSubtask, completeTask, deferTask, reviveTask, archiveOverdueTasks, startTask, completeTimedTask, deleteTaskWithCascade, deleteTask: deleteSingleTask, activeEnergyFilter, setActiveEnergyFilter } = useTasks();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  // Subtask input state
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  // Child highlight state (for shake feedback)
  const [highlightChildrenOf, setHighlightChildrenOf] = useState<string | null>(null);

  // ── Lock state map (computed) ─────────────────────────────────────────────
  const lockMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const task of tasks) {
      map.set(task.id, isTaskLocked(task, tasks));
    }
    return map;
  }, [tasks]);

  // ── Filtered set for Energy ─────────────────────────────────────────────
  const visibleTaskIds = useMemo(() => {
    if (activeEnergyFilter === 'all') return null; // Logic optimization: null means all

    const ids = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const addWithAncestors = (task: Task) => {
      if (ids.has(task.id)) return;
      ids.add(task.id);
      if (task.parentId) {
        const parent = taskMap.get(task.parentId);
        if (parent) addWithAncestors(parent);
      }
    };

    tasks
      .filter(t => t.energyLevel === activeEnergyFilter)
      .forEach(addWithAncestors);
    
    return ids;
  }, [tasks, activeEnergyFilter]);

  const tasksForDisplay = useMemo(() => {
    if (visibleTaskIds === null) return tasks;
    return tasks.filter(t => visibleTaskIds.has(t.id));
  }, [tasks, visibleTaskIds]);

  const displayedTaskCount = useMemo(() => {
    if (activeEnergyFilter === 'all') return tasks.filter(t => !t.isCompleted).length;
    // Count only the MATCHING tasks, not the context tasks
    return tasks.filter(t => !t.isCompleted && t.energyLevel === activeEnergyFilter).length;
  }, [tasks, activeEnergyFilter]);

  // ── Computed data ────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    // Only pass relevant tasks to organizer
    const baseSections = organizeTasks(tasksForDisplay);
    // Flatten each section's data to maintain hierarchy
    return baseSections.map(section => ({
      ...section,
      data: flattenTasksHierarchically(section.data),
    }));
  }, [tasksForDisplay]);

  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchTasks(tasks, searchQuery) : []),
    [tasks, searchQuery],
  );
  
  const activeCount = useMemo(
    () => tasks.filter(t => !t.isCompleted).length,
    [tasks],
  );

  // Count fully decayed tasks for the archive button
  const fullyDecayedCount = useMemo(
    () => tasks.filter(t => isFullyDecayed(t)).length,
    [tasks],
  );

  // Performance: pre-computed layout for FlatList items
  const ITEM_HEIGHT = 52;
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddTask = useCallback(
    (text: string, estimatedMinutes?: number, energyLevel?: EnergyLevel) => {
      addTask(text, { 
        ...(estimatedMinutes ? { estimatedMinutes } : {}),
        energyLevel: energyLevel ?? 'medium'
      });
    },
    [addTask],
  );

  const handleTaskPress = useCallback(
    (task: Task) => {
      navigation.navigate('TaskDetail', { taskId: task.id });
    },
    [navigation],
  );

  const handleOpenSearch = useCallback(() => {
    setIsSearching(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearching(false);
    setSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const handleOpenArchive = useCallback(() => {
    navigation.navigate('Archive');
  }, [navigation]);

  const handleOpenInbox = useCallback(() => {
    navigation.navigate('ProcessInbox');
  }, [navigation]);

  const handleShowArchiveConfirm = useCallback(() => {
    setShowArchiveModal(true);
  }, []);

  const handleConfirmArchive = useCallback(() => {
    archiveOverdueTasks();
    setShowArchiveModal(false);
  }, [archiveOverdueTasks]);

  const handleCancelArchive = useCallback(() => {
    setShowArchiveModal(false);
  }, []);

  const handleRevive = useCallback(
    (id: string) => {
      reviveTask(id);
    },
    [reviveTask],
  );

  const handleStartTask = useCallback(
    (id: string) => {
      startTask(id);
    },
    [startTask],
  );

  const handleCompleteTimedTask = useCallback(
    (id: string, adjustedMinutes?: number) => {
      completeTimedTask(id, adjustedMinutes);
    },
    [completeTimedTask],
  );

  const handleOpenStats = useCallback(() => {
    navigation.navigate('RealityScore');
  }, [navigation]);

  // ── Long-press / Context menu handlers ──────────────────────────────────
  const handleLongPress = useCallback((task: Task) => {
    setContextMenuTask(task);
    setShowContextMenu(true);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false);
    setContextMenuTask(null);
  }, []);

  const handleContextAddSubtask = useCallback(() => {
    if (!contextMenuTask) return;
    if (contextMenuTask.depth >= 3) {
      Alert.alert('Max depth', 'Max 3 levels of subtasks');
      return;
    }
    setSubtaskParentId(contextMenuTask.id);
    setShowSubtaskInput(true);
  }, [contextMenuTask]);

  const handleContextDelete = useCallback(() => {
    if (!contextMenuTask) return;
    const descendantCount = countDescendants(contextMenuTask.id, tasks);
    if (descendantCount > 0) {
      Alert.alert(
        'Delete task',
        `Delete task and ${descendantCount} subtask${descendantCount !== 1 ? 's' : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteTaskWithCascade(contextMenuTask.id),
          },
        ],
      );
    } else {
      Alert.alert('Delete task', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSingleTask(contextMenuTask.id),
        },
      ]);
    }
  }, [contextMenuTask, tasks, deleteTaskWithCascade, deleteSingleTask]);

  const handleSubtaskSubmit = useCallback(
    (text: string, estimatedMinutes?: number) => {
      if (!subtaskParentId) return;
      addSubtask(subtaskParentId, text, estimatedMinutes ? { estimatedMinutes } : undefined);
      setShowSubtaskInput(false);
      setSubtaskParentId(null);
    },
    [subtaskParentId, addSubtask],
  );

  const handleAddSubtaskViaSwipe = useCallback((task: Task) => {
    if (task.depth >= 3) {
      Alert.alert('Max depth', 'Max 3 levels of subtasks');
      return;
    }
    setSubtaskParentId(task.id);
    setShowSubtaskInput(true);
  }, []);

  const handleCompleteWithLockCheck = useCallback(
    (id: string) => {
      const locked = lockMap.get(id) ?? false;
      if (locked) {
        // Trigger highlight on incomplete children
        setHighlightChildrenOf(id);
        setTimeout(() => setHighlightChildrenOf(null), 300);
        return;
      }
      completeTask(id);
    },
    [completeTask, lockMap],
  );

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderTaskItem = useCallback(
    ({ item }: { item: Task }) => {
      const locked = lockMap.get(item.id) ?? false;
      // Check if this is the last child of its parent
      const parentTask = item.parentId
        ? tasks.find(t => t.id === item.parentId)
        : null;
      const parentChildIds = parentTask?.childIds ?? [];
      const isLastChild = parentChildIds.length > 0
        ? parentChildIds[parentChildIds.length - 1] === item.id
        : false;
      // Highlight if parent was shaken
      const shouldHighlight = highlightChildrenOf != null &&
        item.parentId === highlightChildrenOf &&
        !item.isCompleted;

      return (
        <TaskItem
          task={item}
          onPress={handleTaskPress}
          onComplete={handleCompleteWithLockCheck}
          onDefer={deferTask}
          onRevive={handleRevive}
          onStart={handleStartTask}
          onCompleteTimed={handleCompleteTimedTask}
          isLocked={locked}
          isLastChild={isLastChild}
          onLongPress={handleLongPress}
          onAddSubtask={handleAddSubtaskViaSwipe}
          childHighlight={shouldHighlight}
        />
      );
    },
    [handleTaskPress, handleCompleteWithLockCheck, deferTask, handleRevive, handleStartTask, handleCompleteTimedTask, lockMap, tasks, highlightChildrenOf, handleLongPress, handleAddSubtaskViaSwipe],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; data: Task[] } }) => (
      <SectionHeader title={section.title} count={section.data.length} />
    ),
    [],
  );

  const keyExtractor = useCallback((item: Task) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      {isSearching ? (
        <View style={styles.searchHeader}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search tasks..."
            placeholderTextColor={Colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <Pressable onPress={handleCloseSearch} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Tody</Text>
            {activeCount > 0 && (
              <Text style={styles.headerCount}>
                {activeCount} task{activeCount !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <InboxBadge onPress={handleOpenInbox} />
            <Pressable onPress={handleOpenSearch} hitSlop={8} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Search</Text>
            </Pressable>
            <Pressable onPress={handleOpenArchive} hitSlop={8} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Archive</Text>
            </Pressable>
            <Pressable onPress={handleOpenStats} hitSlop={8} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Stats</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Quick Capture ───────────────────────────────────────────────── */}
      {!isSearching && <TaskInput onSubmit={handleAddTask} />}

      {/* ── Task List ───────────────────────────────────────────────────── */}
      {isSearching ? (
        searchQuery.trim() ? (
          <FlatList
            data={searchResults}
            renderItem={renderTaskItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState title="No tasks found" />
            }
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <EmptyState title="No results" subtitle={`for "${searchQuery}"`} />
        )
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderTaskItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <EnergyFilter
              activeFilter={activeEnergyFilter}
              onFilterChange={setActiveEnergyFilter}
              taskCount={displayedTaskCount}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={activeEnergyFilter === 'all' ? "No tasks yet" : `No ${activeEnergyFilter} energy tasks`}
              subtitle={activeEnergyFilter === 'all' ? "Type above to add your first task" : "Try adjusting the filter"}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            fullyDecayedCount > 0 ? (
              <Pressable
                style={styles.archiveButton}
                onPress={handleShowArchiveConfirm}>
                <Text style={styles.archiveButtonText}>
                  Archive {fullyDecayedCount} overdue task{fullyDecayedCount !== 1 ? 's' : ''}
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}

      {/* Quick Capture FAB */}
      {!isSearching && <QuickCaptureFAB />}

      {/* Archive Confirmation Modal */}
      <Modal
        visible={showArchiveModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelArchive}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Move {fullyDecayedCount} task{fullyDecayedCount !== 1 ? 's' : ''} to archive?
            </Text>
            <Text style={styles.modalSubtitle}>
              These tasks have been overdue for 7+ days.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={handleCancelArchive}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalArchiveButton}
                onPress={handleConfirmArchive}>
                <Text style={styles.modalArchiveText}>Archive</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Context Menu */}
      <TaskContextMenu
        visible={showContextMenu}
        onClose={handleCloseContextMenu}
        onAddSubtask={handleContextAddSubtask}
        onDelete={handleContextDelete}
        canAddSubtask={contextMenuTask ? contextMenuTask.depth < 3 : false}
      />

      {/* Subtask Input Modal */}
      <Modal
        visible={showSubtaskInput}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSubtaskInput(false);
          setSubtaskParentId(null);
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add subtask</Text>
            <TaskInput
              onSubmit={handleSubtaskSubmit}
              placeholder="Subtask title..."
              autoFocus
            />
            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setShowSubtaskInput(false);
                setSubtaskParentId(null);
              }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: Colors.text,
  },
  headerCount: {
    ...Typography.small,
    color: Colors.gray400,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingBottom: 4,
  },
  headerButton: {
    paddingVertical: Spacing.xs,
  },
  headerButtonText: {
    ...Typography.link,
    color: Colors.textTertiary,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 2,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.text,
  },
  cancelText: {
    ...Typography.link,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingBottom: 100,
  },
  archiveButton: {
    backgroundColor: Colors.gray50,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: 4,
    alignItems: 'center',
  },
  archiveButtonText: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  modalTitle: {
    ...Typography.bodyMedium,
    color: Colors.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.xl,
  },
  modalCancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  modalCancelText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  modalArchiveButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.text,
    borderRadius: 4,
  },
  modalArchiveText: {
    ...Typography.body,
    color: Colors.white,
  },
});
