import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { TaskItem } from '../components/TaskItem';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { Colors, Spacing, Typography } from '../utils/colors';
import { Task, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Archive'>;
};

export function ArchiveScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, archivedTasks, uncompleteTask } = useTasks();
  const { logout, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const completedTasks = useMemo(() => {
    const completed = tasks
      .filter(t => t.isCompleted)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

    if (!searchQuery.trim()) { return completed; }

    const q = searchQuery.toLowerCase();
    return completed.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  const filteredArchivedTasks = useMemo(() => {
    const sorted = [...archivedTasks].sort(
      (a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0),
    );

    if (!searchQuery.trim()) { return sorted; }

    const q = searchQuery.toLowerCase();
    return sorted.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [archivedTasks, searchQuery]);

  const totalCompleted = useMemo(
    () => tasks.filter(t => t.isCompleted).length,
    [tasks],
  );

  const sections = useMemo(() => {
    const result: { title: string; data: Task[] }[] = [];
    if (filteredArchivedTasks.length > 0) {
      result.push({ title: 'OVERDUE ARCHIVED', data: filteredArchivedTasks });
    }
    if (completedTasks.length > 0) {
      result.push({ title: 'COMPLETED', data: completedTasks });
    }
    return result;
  }, [filteredArchivedTasks, completedTasks]);

  const handleTaskPress = useCallback(
    (task: Task) => {
      navigation.navigate('TaskDetail', { taskId: task.id });
    },
    [navigation],
  );

  const handleRestore = useCallback(
    (id: string) => {
      uncompleteTask(id);
    },
    [uncompleteTask],
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const renderItem = useCallback(
    ({ item }: { item: Task }) => (
      <TaskItem
        task={item}
        onPress={handleTaskPress}
        onComplete={handleRestore}
        onDefer={() => {}}
      />
    ),
    [handleTaskPress, handleRestore],
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Text style={styles.headerTitle}>Archive</Text>
          {(totalCompleted > 0 || archivedTasks.length > 0) && (
            <Text style={styles.headerCount}>
              {totalCompleted + archivedTasks.length} items
            </Text>
          )}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search archived tasks..."
          placeholderTextColor={Colors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* List */}
      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title={searchQuery ? 'No results' : 'No archived tasks'}
              subtitle={searchQuery ? undefined : 'Overdue tasks auto-archive after 7 days'}
              icon={searchQuery ? 'search-outline' : 'archive-outline'}
              iconColor="#F59E0B"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <EmptyState
          title={searchQuery ? 'No results' : 'No archived tasks'}
          subtitle={searchQuery ? undefined : 'Completed and overdue-archived tasks appear here'}
          icon={searchQuery ? 'search-outline' : 'archive-outline'}
          iconColor="#F59E0B"
        />
      )}

      {/* Footer: account info + sign out */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Text style={styles.footerEmail}>{user?.email}</Text>
        <Pressable onPress={handleLogout} hitSlop={8}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  backText: {
    ...Typography.link,
    color: Colors.textSecondary,
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...Typography.heading,
  },
  headerCount: {
    ...Typography.small,
    color: Colors.gray400,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 2,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.text,
  },
  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerEmail: {
    ...Typography.small,
    color: Colors.gray400,
  },
  signOutText: {
    ...Typography.caption,
    color: Colors.gray800,
    fontWeight: '500',
  },
});
