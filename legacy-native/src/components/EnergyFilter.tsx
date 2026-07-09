import React, { memo, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import Animated, { LinearTransition, ZoomIn, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { Category } from '../types';
import { haptic } from '../utils/haptics';

// ── Props ────────────────────────────────────────────────────────────────────

interface TabManagerProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  onAddPress: () => void;
  onManagePress: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
  onAddPress,
  onManagePress,
}: TabManagerProps) {
  const scrollRef = useRef<ScrollView>(null);

  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  // Shadow-fade indicator for scrollable categories
  const shadowOpacity = useSharedValue(sorted.length > 3 ? 1 : 0);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromEnd = contentSize.width - layoutMeasurement.width - contentOffset.x;
    // Show shadow when there's more than 8px of content to scroll
    shadowOpacity.value = withTiming(distanceFromEnd > 8 ? 1 : 0, { duration: 200 });
  }, [shadowOpacity]);

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Tab row */}
      <View style={styles.row}>
        <View style={styles.scrollContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScroll}
            keyboardShouldPersistTaps="always"
            onScroll={handleScroll}
            scrollEventThrottle={16}
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
          {/* Right-side shadow indicating more categories */}
          <Animated.View style={[styles.scrollShadow, shadowStyle]} pointerEvents="none" />
        </View>
        {/* Tab management buttons */}
        <View style={styles.actions}>
          <Pressable onPress={() => { haptic('light'); onAddPress(); }} hitSlop={6} style={styles.actionBtn}>
            <Icon name="add" size={18} color={colors.gray500} />
          </Pressable>
          <Pressable onPress={() => { haptic('light'); onManagePress(); }} hitSlop={6} style={styles.actionBtn}>
            <Icon name="pencil-outline" size={15} color={colors.gray500} />
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
  scrollContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  scrollShadow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    backgroundColor: 'transparent',
    // Linear shadow effect using multiple box shadows on iOS, elevation on Android
    ...(isDark
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: -12, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 10,
          // Semi-transparent background for the fade-out effect
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderLeftColor: 'rgba(255,255,255,0.06)',
        }
      : {
          shadowColor: c.background,
          shadowOffset: { width: -12, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 10,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderLeftColor: 'rgba(0,0,0,0.06)',
        }),
    elevation: 8,
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
});
