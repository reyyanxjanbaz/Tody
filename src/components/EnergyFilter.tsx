import React, { memo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { Category, SortOption } from '../types';
import { haptic } from '../utils/haptics';

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
  const { colors, isDark } = useTheme();

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab row */}
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
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
                  <Text style={[styles.tabLabel, { color: colors.textTertiary }, isActive && { color: colors.text, fontWeight: '700' }]}>
                    {cat.name}
                  </Text>
                  {isActive && (
                    <Animated.View
                      layout={LinearTransition.springify().damping(20).stiffness(300)}
                      entering={ZoomIn.duration(200)}
                      style={[styles.activeIndicator, { backgroundColor: isDark ? colors.text : Colors.black }, cat.id !== 'overview' && { backgroundColor: cat.color }]}
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
            <Icon name="add" size={18} color={colors.textTertiary} />
          </Pressable>
          <Pressable onPress={() => { haptic('light'); onManagePress(); }} hitSlop={6} style={styles.actionBtn}>
            <Icon name="pencil-outline" size={15} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => { haptic('light'); onSortPress(); }}
            style={[styles.sortFab, { backgroundColor: isDark ? colors.gray200 : Colors.surfaceDark, borderColor: isDark ? colors.gray400 : Colors.gray800 }, sortOption !== 'default' && { backgroundColor: isDark ? colors.text : Colors.black }]}
            hitSlop={6}
          >
            <Icon
              name={sortOption === 'default' ? 'swap-vertical-outline' : 'swap-vertical'}
              size={13}
              color={isDark ? Colors.black : Colors.white}
            />
            <Text style={[styles.sortFabText, { color: isDark ? Colors.black : Colors.white }]}>Sort</Text>
            {sortOption !== 'default' && <View style={styles.sortFabDot} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
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
    letterSpacing: -0.3,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -Spacing.md - 2,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 4,
  },
  actionBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortFabText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  sortFabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.gray200,
  },
});
