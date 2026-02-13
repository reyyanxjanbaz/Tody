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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTasks } from '../context/TaskContext';
import { TaskInput } from '../components/TaskInput';
import { TaskItem } from '../components/TaskItem';
import { SectionHeader } from '../components/SectionHeader';
import { EmptyState } from '../components/EmptyState';
import { organizeTasks, searchTasks } from '../utils/taskIntelligence';
import { Colors, Spacing, Typography } from '../utils/colors';
import { Task, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, addTask, completeTask, deferTask } = useTasks();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderTaskItem = useCallback(
    ({ item }: { item: Task }) => (
      <TaskItem
        task={item}
        onPress={handleTaskPress}
        onComplete={completeTask}
        onDefer={deferTask}
      />
    ),
    [handleTaskPress, completeTask, deferTask],
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
        />
      ) : (
        <EmptyState
          title="No tasks yet"
          subtitle='Type above to add your first task'
        />
      )}
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
});
