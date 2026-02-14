import React, { memo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
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
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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
            <Icon name="add" size={18} color={colors.gray500} />
          </Pressable>
          <Pressable onPress={() => { haptic('light'); onManagePress(); }} hitSlop={6} style={styles.actionBtn}>
            <Icon name="pencil-outline" size={15} color={colors.gray500} />
          </Pressable>
          <Pressable
            onPress={() => { haptic('light'); onSortPress(); }}
            style={[styles.sortFab, sortOption !== 'default' && styles.sortFabActive]}
            hitSlop={6}
          >
            <Icon
              name={sortOption === 'default' ? 'swap-vertical-outline' : 'swap-vertical'}
              size={13}
              color={colors.white}
            />
            <Text style={styles.sortFabText}>Sort</Text>
            {sortOption !== 'default' && <View style={styles.sortFabDot} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    backgroundColor: c.background,
    paddingTop: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.gray100,
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
    color: c.gray400,
    letterSpacing: -0.3,
    fontFamily: FontFamily,
  },
  tabLabelActive: {
    color: c.text,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -Spacing.md - 2,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: c.text,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : c.surfaceDark,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : c.gray800,
  },
  sortFabActive: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : c.black,
  },
  sortFabText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.white,
    letterSpacing: 0.1,
    fontFamily: FontFamily,
  },
  sortFabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: c.gray200,
  },
});
