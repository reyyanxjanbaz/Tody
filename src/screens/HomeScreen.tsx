import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    Keyboard,
    Modal,
    Alert,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTasks } from '../context/TaskContext';
import { TaskInput } from '../components/TaskInput';
import { TaskItem } from '../components/TaskItem';
import { EnergyFilter } from '../components/EnergyFilter';
import { SectionHeader } from '../components/SectionHeader';
import { EmptyState } from '../components/EmptyState';
import { QuickCaptureFAB } from '../components/QuickCaptureFAB';
import { InboxBadge } from '../components/InboxBadge';
import { TaskPreviewOverlay } from '../components/TaskPreviewOverlay';
import { BatchModeBar, BatchCheckbox } from '../components/BatchMode';
import { ZeroStateOnboarding } from '../components/ZeroStateOnboarding';
import { FocusMode } from '../components/FocusMode';
import { TodayLine } from '../components/TodayLine';
import { AnimatedPressable } from '../components/ui';
import { useUndo } from '../components/UndoToast';
import { organizeTasks, searchTasks } from '../utils/taskIntelligence';
import { isFullyDecayed } from '../utils/decay';
import {
    isTaskLocked,
    countDescendants,
    flattenTasksHierarchically,
} from '../utils/dependencyChains';
import { Colors, Spacing, Typography, Shadows, BorderRadius } from '../utils/colors';
import { Task, RootStackParamList, EnergyLevel } from '../types';
import { haptic } from '../utils/haptics';

// ── FlashList item discriminated union ────────────────────────────────────────

interface SectionHeaderItem {
    type: 'section-header';
    title: string;
    count: number;
}

interface TodayLineItem {
    type: 'today-line';
}

interface TaskListItem {
    type: 'task';
    task: Task;
}

type ListItem = SectionHeaderItem | TodayLineItem | TaskListItem;

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const {
        tasks,
        addTask,
        addSubtask,
        completeTask,
        deferTask,
        reviveTask,
        archiveOverdueTasks,
        startTask,
        completeTimedTask,
        deleteTaskWithCascade,
        deleteTask: deleteSingleTask,
        activeEnergyFilter,
        setActiveEnergyFilter,
        uncompleteTask,
        restoreTasks,
    } = useTasks();
    const { showUndo } = useUndo();
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
    const [highlightChildrenOf, setHighlightChildrenOf] = useState<string | null>(
        null,
    );
    // Batch mode state
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
        new Set(),
    );
    // Focus mode state
    const [isFocusMode, setIsFocusMode] = useState(false);

    // ── Lock state map (computed) ──────────────────────────────────────────────
    const lockMap = useMemo(() => {
        const map = new Map<string, boolean>();
        for (const task of tasks) {
            map.set(task.id, isTaskLocked(task, tasks));
        }
        return map;
    }, [tasks]);

    // ── Filtered set for Energy ────────────────────────────────────────────────
    const visibleTaskIds = useMemo(() => {
        if (activeEnergyFilter === 'all') return null;

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
        if (activeEnergyFilter === 'all')
            return tasks.filter(t => !t.isCompleted).length;
        return tasks.filter(
            t => !t.isCompleted && t.energyLevel === activeEnergyFilter,
        ).length;
    }, [tasks, activeEnergyFilter]);

    // ── Computed data ──────────────────────────────────────────────────────────
    const sections = useMemo(() => {
        const baseSections = organizeTasks(tasksForDisplay);
        return baseSections.map(section => ({
            ...section,
            data: flattenTasksHierarchically(section.data),
        }));
    }, [tasksForDisplay]);

    // ── Flatten sections for FlashList ─────────────────────────────────────────
    const flattenedItems = useMemo(() => {
        const items: ListItem[] = [];
        for (const section of sections) {
            if (section.title === 'TODAY') {
                items.push({ type: 'today-line' });
            } else {
                items.push({
                    type: 'section-header',
                    title: section.title,
                    count: section.data.length,
                });
            }
            for (const task of section.data) {
                items.push({ type: 'task', task });
            }
        }
        return items;
    }, [sections]);

    const searchResults = useMemo(
        () => (searchQuery.trim() ? searchTasks(tasks, searchQuery) : []),
        [tasks, searchQuery],
    );

    const activeCount = useMemo(
        () => tasks.filter(t => !t.isCompleted).length,
        [tasks],
    );

    const focusTasks = useMemo(
        () =>
            tasks
                .filter(t => !t.isCompleted && t.depth === 0)
                .sort((a, b) => {
                    const aScore = a.deadline
                        ? a.deadline < Date.now()
                            ? 0
                            : a.deadline
                        : Infinity;
                    const bScore = b.deadline
                        ? b.deadline < Date.now()
                            ? 0
                            : b.deadline
                        : Infinity;
                    return aScore - bScore;
                }),
        [tasks],
    );

    const fullyDecayedCount = useMemo(
        () => tasks.filter(t => isFullyDecayed(t)).length,
        [tasks],
    );

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleAddTask = useCallback(
        (text: string, estimatedMinutes?: number, energyLevel?: EnergyLevel) => {
            addTask(text, {
                ...(estimatedMinutes ? { estimatedMinutes } : {}),
                energyLevel: energyLevel ?? 'medium',
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
        haptic('light');
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
        haptic('medium');
        setShowArchiveModal(true);
    }, []);

    const handleConfirmArchive = useCallback(() => {
        archiveOverdueTasks();
        setShowArchiveModal(false);
        haptic('success');
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

    // ── Long-press / Context menu handlers ─────────────────────────────────────
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
                        onPress: () => {
                            const getDescIds = (id: string): string[] => {
                                const t = tasks.find(x => x.id === id);
                                if (!t) return [];
                                return t.childIds.flatMap(cid => [cid, ...getDescIds(cid)]);
                            };
                            const allIds = [
                                contextMenuTask.id,
                                ...getDescIds(contextMenuTask.id),
                            ];
                            const snapshots = tasks.filter(t => allIds.includes(t.id));
                            deleteTaskWithCascade(contextMenuTask.id);
                            showUndo(
                                `"${contextMenuTask.title}" + ${descendantCount} deleted`,
                                () => restoreTasks(snapshots),
                            );
                        },
                    },
                ],
            );
        } else {
            const snapshot = { ...contextMenuTask };
            deleteSingleTask(contextMenuTask.id);
            showUndo(`"${contextMenuTask.title}" deleted`, () =>
                restoreTasks([snapshot]),
            );
        }
    }, [
        contextMenuTask,
        tasks,
        deleteTaskWithCascade,
        deleteSingleTask,
        showUndo,
        restoreTasks,
    ]);

    const handleSubtaskSubmit = useCallback(
        (text: string, estimatedMinutes?: number) => {
            if (!subtaskParentId) return;
            addSubtask(
                subtaskParentId,
                text,
                estimatedMinutes ? { estimatedMinutes } : undefined,
            );
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
                setHighlightChildrenOf(id);
                setTimeout(() => setHighlightChildrenOf(null), 300);
                return;
            }
            const task = tasks.find(t => t.id === id);
            completeTask(id);
            if (task) {
                showUndo(`"${task.title}" completed`, () => uncompleteTask(id));
            }
        },
        [completeTask, lockMap, tasks, showUndo, uncompleteTask],
    );

    // Batch toggle helper
    const toggleBatchSelection = useCallback((id: string) => {
        setSelectedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // ── Render helpers ─────────────────────────────────────────────────────────

    /** Render the actual TaskItem row (shared between main list and search) */
    const renderTaskContent = useCallback(
        (task: Task) => {
            const locked = lockMap.get(task.id) ?? false;
            const parentTask = task.parentId
                ? tasks.find(t => t.id === task.parentId)
                : null;
            const parentChildIds = parentTask?.childIds ?? [];
            const isLastChild =
                parentChildIds.length > 0
                    ? parentChildIds[parentChildIds.length - 1] === task.id
                    : false;
            const shouldHighlight =
                highlightChildrenOf != null &&
                task.parentId === highlightChildrenOf &&
                !task.isCompleted;

            return (
                <View style={styles.taskRow}>
                    {isBatchMode && (
                        <BatchCheckbox
                            selected={selectedTaskIds.has(task.id)}
                            onToggle={() => toggleBatchSelection(task.id)}
                        />
                    )}
                    <View style={styles.flex1}>
                        <TaskItem
                            task={task}
                            onPress={
                                isBatchMode
                                    ? () => toggleBatchSelection(task.id)
                                    : handleTaskPress
                            }
                            onComplete={handleCompleteWithLockCheck}
                            onDefer={deferTask}
                            onRevive={handleRevive}
                            onStart={handleStartTask}
                            onCompleteTimed={handleCompleteTimedTask}
                            isLocked={locked}
                            isLastChild={isLastChild}
                            onLongPress={isBatchMode ? undefined : handleLongPress}
                            onAddSubtask={handleAddSubtaskViaSwipe}
                            childHighlight={shouldHighlight}
                        />
                    </View>
                </View>
            );
        },
        [
            handleTaskPress,
            handleCompleteWithLockCheck,
            deferTask,
            handleRevive,
            handleStartTask,
            handleCompleteTimedTask,
            lockMap,
            tasks,
            highlightChildrenOf,
            handleLongPress,
            handleAddSubtaskViaSwipe,
            isBatchMode,
            selectedTaskIds,
            toggleBatchSelection,
        ],
    );

    /** FlashList renderItem – handles section headers, today-line, and tasks */
    const renderFlashListItem = useCallback(
        ({ item }: { item: ListItem }) => {
            switch (item.type) {
                case 'today-line':
                    return <TodayLine />;
                case 'section-header':
                    return <SectionHeader title={item.title} count={item.count} />;
                case 'task':
                    return renderTaskContent(item.task);
            }
        },
        [renderTaskContent],
    );

    /** Search FlashList renderItem */
    const renderSearchItem = useCallback(
        ({ item }: { item: Task }) => renderTaskContent(item),
        [renderTaskContent],
    );

    const flashListKeyExtractor = useCallback((item: ListItem) => {
        switch (item.type) {
            case 'today-line':
                return '__today-line__';
            case 'section-header':
                return `__section-${item.title}__`;
            case 'task':
                return item.task.id;
        }
    }, []);

    const searchKeyExtractor = useCallback((item: Task) => item.id, []);

    /** FlashList recycling type – enables separate pools for headers vs tasks */
    const getItemType = useCallback((item: ListItem) => item.type, []);

    /** Override item layout for known-size items (headers, today-line) */
    const overrideItemLayout = useCallback(
        (layout: { size?: number; span?: number }, item: ListItem) => {
            if (item.type === 'section-header') {
                layout.size = 40;
            } else if (item.type === 'today-line') {
                layout.size = 32;
            }
            // task items use estimatedItemSize (52)
        },
        [],
    );

    // ── Pre-built empty / footer components ────────────────────────────────────

    const ListEmpty = useMemo(() => {
        if (activeCount === 0 && activeEnergyFilter === 'all') {
            return (
                <ZeroStateOnboarding
                    onSelectTemplate={templateTasks => {
                        templateTasks.forEach(t => {
                            addTask(t.title, {
                                priority: t.priority,
                                energyLevel: t.energyLevel,
                                estimatedMinutes: t.estimatedMinutes ?? null,
                            });
                        });
                    }}
                    onDismiss={() => { }}
                />
            );
        }
        return (
            <EmptyState
                title={
                    activeEnergyFilter === 'all'
                        ? 'No tasks yet'
                        : `No ${activeEnergyFilter} energy tasks`
                }
                subtitle={
                    activeEnergyFilter === 'all'
                        ? 'Type above to add your first task'
                        : 'Create one or switch filter'
                }
                icon={activeEnergyFilter === 'all' ? undefined : 'flash-outline'}
                iconColor={
                    activeEnergyFilter === 'high'
                        ? '#EF4444'
                        : activeEnergyFilter === 'medium'
                            ? '#F59E0B'
                            : '#22C55E'
                }
            />
        );
    }, [activeCount, activeEnergyFilter, addTask]);

    const ListFooter = useMemo(() => {
        if (fullyDecayedCount <= 0) return null;
        return (
            <AnimatedPressable
                onPress={handleShowArchiveConfirm}
                hapticStyle="medium">
                <View style={styles.archiveButton}>
                    <Text style={styles.archiveButtonText}>
                        Archive {fullyDecayedCount} overdue task
                        {fullyDecayedCount !== 1 ? 's' : ''}
                    </Text>
                </View>
            </AnimatedPressable>
        );
    }, [fullyDecayedCount, handleShowArchiveConfirm]);

    // ── JSX ────────────────────────────────────────────────────────────────────

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* ── Header ──────────────────────────────────────────────────────── */}
            {isSearching ? (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.searchHeader}>
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
                    <AnimatedPressable onPress={handleCloseSearch} hitSlop={8}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </AnimatedPressable>
                </Animated.View>
            ) : (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Tody</Text>
                        {activeCount > 0 && (
                            <Text style={styles.headerCount}>
                                {activeCount} task{activeCount !== 1 ? 's' : ''}
                            </Text>
                        )}
                    </View>
                    <AnimatedPressable
                        onPress={handleOpenSearch}
                        hitSlop={8}
                        style={styles.topSearchButton}>
                        <Icon name="search-outline" size={26} color={Colors.text} />
                    </AnimatedPressable>
                </Animated.View>
            )}

            {/* ── Task List (FlashList) ───────────────────────────────────────── */}
            {isSearching ? (
                searchQuery.trim() ? (
                    <FlashList
                        data={searchResults}
                        renderItem={renderSearchItem}
                        keyExtractor={searchKeyExtractor}
                        estimatedItemSize={52}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            <EmptyState
                                title="No tasks found"
                                subtitle="Try different keywords"
                                icon="search-outline"
                            />
                        }
                        contentContainerStyle={styles.listContent}
                    />
                ) : (
                    <EmptyState
                        title="No results"
                        subtitle={`for "${searchQuery}"`}
                        icon="search-outline"
                    />
                )
            ) : (
                <FlashList
                    data={flattenedItems}
                    renderItem={renderFlashListItem}
                    keyExtractor={flashListKeyExtractor}
                    getItemType={getItemType}
                    estimatedItemSize={52}
                    overrideItemLayout={overrideItemLayout}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={() => setIsFocusMode(true)}
                            tintColor={Colors.black}
                            title="Pull for Focus Mode"
                            titleColor={Colors.gray400}
                        />
                    }
                    ListHeaderComponent={
                        <EnergyFilter
                            activeFilter={activeEnergyFilter}
                            onFilterChange={setActiveEnergyFilter}
                            taskCount={displayedTaskCount}
                        />
                    }
                    ListEmptyComponent={ListEmpty}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ ...styles.listContent, paddingBottom: 180 }}
                    ListFooterComponent={ListFooter}
                />
            )}

            {/* ── Bottom Controls ───────────────────────────────────────── */}
            {!isSearching && !isBatchMode && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    style={styles.bottomControlsWrapper}
                >
                    <TaskInput onSubmit={handleAddTask} />

                    {/* Bottom Nav Bar */}
                    <View style={[styles.bottomNavBar, { paddingBottom: insets.bottom }]}>
                        <InboxBadge onPress={handleOpenInbox} />

                        <AnimatedPressable
                            onPress={handleOpenArchive}
                            hitSlop={8}
                            style={styles.navButton}>
                            <Icon name="archive-outline" size={24} color={Colors.textTertiary} />
                            <Text style={styles.navButtonText}>Archive</Text>
                        </AnimatedPressable>

                        <AnimatedPressable
                            onPress={handleOpenStats}
                            hitSlop={8}
                            style={styles.navButton}>
                            <Icon name="stats-chart-outline" size={24} color={Colors.textTertiary} />
                            <Text style={styles.navButtonText}>Stats</Text>
                        </AnimatedPressable>

                        <AnimatedPressable
                            onPress={() => {
                                haptic('selection');
                                setIsBatchMode(!isBatchMode);
                                setSelectedTaskIds(new Set());
                            }}
                            hitSlop={8}
                            style={styles.navButton}>
                            <Icon
                                name="checkbox-outline"
                                size={24}
                                color={Colors.textTertiary}
                            />
                            <Text style={styles.navButtonText}>Batch</Text>
                        </AnimatedPressable>
                    </View>
                </KeyboardAvoidingView>
            )}

            {/* Batch Mode Bottom Bar */}
            {isBatchMode && (
                <BatchModeBar
                    selectedCount={selectedTaskIds.size}
                    onCompleteAll={() => {
                        const ids = Array.from(selectedTaskIds);
                        ids.forEach(id => completeTask(id));
                        showUndo(
                            `${ids.length} task${ids.length !== 1 ? 's' : ''} completed`,
                            () => {
                                ids.forEach(id => uncompleteTask(id));
                            },
                        );
                        setSelectedTaskIds(new Set());
                        setIsBatchMode(false);
                        haptic('success');
                    }}
                    onDeleteAll={() => {
                        const ids = Array.from(selectedTaskIds);
                        const snapshots = tasks.filter(t => ids.includes(t.id));
                        ids.forEach(id => deleteSingleTask(id));
                        showUndo(
                            `${ids.length} task${ids.length !== 1 ? 's' : ''} deleted`,
                            () => {
                                restoreTasks(snapshots);
                            },
                        );
                        setSelectedTaskIds(new Set());
                        setIsBatchMode(false);
                        haptic('warning');
                    }}
                    onArchiveAll={() => {
                        const ids = Array.from(selectedTaskIds);
                        ids.forEach(id => completeTask(id));
                        showUndo(
                            `${ids.length} task${ids.length !== 1 ? 's' : ''} archived`,
                            () => {
                                ids.forEach(id => uncompleteTask(id));
                            },
                        );
                        setSelectedTaskIds(new Set());
                        setIsBatchMode(false);
                        haptic('success');
                    }}
                    onCancel={() => {
                        setIsBatchMode(false);
                        setSelectedTaskIds(new Set());
                    }}
                />
            )}

            {/* Archive Confirmation Modal */}
            <Modal
                visible={showArchiveModal}
                transparent
                animationType="fade"
                onRequestClose={handleCancelArchive}>
                <View style={styles.modalOverlay}>
                    <Animated.View
                        entering={FadeIn.duration(250)}
                        style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            Move {fullyDecayedCount} task
                            {fullyDecayedCount !== 1 ? 's' : ''} to archive?
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
                    </Animated.View>
                </View>
            </Modal>

            {/* Long-Press Preview Overlay */}
            <TaskPreviewOverlay
                visible={showContextMenu}
                task={contextMenuTask}
                onClose={handleCloseContextMenu}
                onEdit={task => navigation.navigate('TaskDetail', { taskId: task.id })}
                onAddSubtask={task => {
                    if (task.depth >= 3) {
                        Alert.alert('Max depth', 'Max 3 levels of subtasks');
                        return;
                    }
                    setSubtaskParentId(task.id);
                    setShowSubtaskInput(true);
                }}
                onDelete={task => {
                    handleCloseContextMenu();
                    setContextMenuTask(task);
                    handleContextDelete();
                }}
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
                    <Animated.View
                        entering={FadeIn.duration(250)}
                        style={styles.modalCard}>
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
                    </Animated.View>
                </View>
            </Modal>

            {/* Focus Mode Overlay */}
            <FocusMode
                visible={isFocusMode}
                tasks={focusTasks}
                onComplete={id => completeTask(id)}
                onExit={() => setIsFocusMode(false)}
            />
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
        paddingHorizontal: Spacing.xxl,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    headerTitle: {
        fontSize: 36,
        fontWeight: '800',
        letterSpacing: -1,
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
        alignItems: 'center',
        gap: 2,
        paddingVertical: Spacing.xs,
    },
    headerButtonText: {
        ...Typography.small,
        fontWeight: '600',
        color: Colors.textTertiary,
    },
    bottomControlsWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
    },
    bottomNavBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.border,
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    navButton: {
        alignItems: 'center',
        gap: 2,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
    },
    navButtonText: {
        ...Typography.small,
        fontWeight: '600',
        color: Colors.textTertiary,
    },
    topSearchButton: {
        padding: Spacing.sm,
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
        height: 48,
        borderWidth: 0,
        borderColor: 'transparent',
        borderRadius: BorderRadius.input,
        paddingHorizontal: Spacing.lg,
        backgroundColor: '#F2F2F7',
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
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    flex1: {
        flex: 1,
    },
    archiveButton: {
        backgroundColor: Colors.surfaceDark,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.lg,
        borderRadius: BorderRadius.button,
        alignItems: 'center',
    },
    archiveButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.white,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCard: {
        width: '85%',
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.card,
        paddingVertical: Spacing.xxl,
        paddingHorizontal: Spacing.xxl,
        ...Shadows.floating,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.10)',
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
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xxl,
        backgroundColor: Colors.surfaceDark,
        borderRadius: BorderRadius.button,
    },
    modalArchiveText: {
        ...Typography.body,
        color: Colors.white,
    },
});
