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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTasks } from '../context/TaskContext';
import { TaskInput } from '../components/TaskInput';
import { TaskItem } from '../components/TaskItem';
import { SectionHeader } from '../components/SectionHeader';
import { EmptyState } from '../components/EmptyState';
import { QuickCaptureFAB } from '../components/QuickCaptureFAB';
import { InboxBadge } from '../components/InboxBadge';
import { organizeTasks, searchTasks } from '../utils/taskIntelligence';
import { isFullyDecayed } from '../utils/decay';
import { Colors, Spacing, Typography } from '../utils/colors';
import { Task, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, addTask, completeTask, deferTask, reviveTask, archiveOverdueTasks } = useTasks();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // ── Computed data ────────────────────────────────────────────────────────
  const sections = useMemo(() => organizeTasks(tasks), [tasks]);
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

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddTask = useCallback(
    (text: string) => {
      addTask(text);
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

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderTaskItem = useCallback(
    ({ item }: { item: Task }) => (
      <TaskItem
        task={item}
        onPress={handleTaskPress}
        onComplete={completeTask}
        onDefer={deferTask}
        onRevive={handleRevive}
      />
    ),
    [handleTaskPress, completeTask, deferTask, handleRevive],
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
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState title="No tasks found" />
            }
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <EmptyState title="Type to search" subtitle="Search across all tasks" />
        )
      ) : sections.length > 0 ? (
        <SectionList
          sections={sections}
          renderItem={renderTaskItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
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
      ) : (
        <EmptyState
          title="No tasks yet"
          subtitle='Type above to add your first task'
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
