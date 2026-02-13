import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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
import { Colors, Spacing, Typography } from '../utils/colors';
import { Task, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Archive'>;
};

export function ArchiveScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { tasks, uncompleteTask } = useTasks();
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

  const totalCompleted = useMemo(
    () => tasks.filter(t => t.isCompleted).length,
    [tasks],
  );

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
          {totalCompleted > 0 && (
            <Text style={styles.headerCount}>{totalCompleted} done</Text>
          )}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search completed tasks..."
          placeholderTextColor={Colors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* List */}
      <FlatList
        data={completedTasks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            title={searchQuery ? 'No results' : 'No completed tasks'}
            subtitle={searchQuery ? undefined : 'Completed tasks appear here'}
          />
        }
        contentContainerStyle={styles.listContent}
      />

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
