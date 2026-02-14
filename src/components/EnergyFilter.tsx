import React, { memo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography } from '../utils/colors';
import { Category, SortOption } from '../types';
import { haptic } from '../utils/haptics';

// ── Sort labels ──────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortOption, string> = {
  'default': 'Default',
  'deadline-asc': 'Deadline ↑',
  'deadline-desc': 'Deadline ↓',
  'priority-high': 'Priority ↑',
  'priority-low': 'Priority ↓',
  'newest': 'Newest',
  'oldest': 'Oldest',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface TabManagerProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  onAddPress: () => void;
  onManagePress: () => void;
  sortOption: SortOption;
  onSortPress: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
  onAddPress,
  onManagePress,
  sortOption,
  onSortPress,
}: TabManagerProps) {
  const scrollRef = useRef<ScrollView>(null);

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  return (
    <View style={styles.container}>
      {/* Tab row */}
      <View style={styles.row}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
          keyboardShouldPersistTaps="always"
        >
          {sorted.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  haptic('selection');
                  onCategoryChange(cat.id);
                }}
                style={styles.tab}
                hitSlop={6}
              >
                <View style={styles.tabContent}>
                  {cat.id !== 'overview' && (
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                  )}
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {cat.name}
                  </Text>
                  {isActive && (
                    <Animated.View
                      layout={LinearTransition.springify().damping(20).stiffness(300)}
                      entering={ZoomIn.duration(200)}
                      style={[styles.activeIndicator, cat.id !== 'overview' && { backgroundColor: cat.color }]}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tab management buttons */}
        <View style={styles.actions}>
          <Pressable onPress={() => { haptic('light'); onAddPress(); }} hitSlop={6} style={styles.actionBtn}>
            <Icon name="add" size={18} color={Colors.gray500} />
          </Pressable>
          <Pressable onPress={() => { haptic('light'); onManagePress(); }} hitSlop={6} style={styles.actionBtn}>
            <Icon name="pencil-outline" size={15} color={Colors.gray500} />
          </Pressable>
        </View>
      </View>

      {/* Sort bar — sits below tabs */}
      <Pressable
        onPress={() => { haptic('light'); onSortPress(); }}
        style={styles.sortBar}
        hitSlop={4}
      >
        <Icon
          name={sortOption === 'default' ? 'swap-vertical-outline' : 'swap-vertical'}
          size={13}
          color={sortOption === 'default' ? Colors.gray400 : Colors.text}
        />
        <Text style={[styles.sortText, sortOption !== 'default' && styles.sortTextActive]}>
          {sortOption === 'default' ? 'Sort' : SORT_LABELS[sortOption]}
        </Text>
      </Pressable>
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingTop: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  tabScroll: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    gap: Spacing.xl,
  },
  tab: {
    paddingBottom: Spacing.md,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.gray400,
    letterSpacing: -0.3,
  },
  tabLabelActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -Spacing.md - 2,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.black,
    borderRadius: 1.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  actionBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.gray50,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.gray400,
    letterSpacing: 0.1,
  },
  sortTextActive: {
    fontWeight: '700',
    color: Colors.text,
  },
});
