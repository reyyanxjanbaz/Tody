import React, { memo, useState, useCallback } from 'react';
import { Pressable, Text, View, StyleSheet, Modal, FlatList } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { Category } from '../types';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY } from '../utils/animations';

interface CategoryPillProps {
  value: string; // category id
  categories: Category[]; // assignable categories (no overview)
  onChange: (categoryId: string) => void;
}

export const CategoryPill = memo(function CategoryPill({
  value,
  categories,
  onChange,
}: CategoryPillProps) {
  const { colors, shadows, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [showDropdown, setShowDropdown] = useState(false);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const current = categories.find(c => c.id === value);
  const color = current?.color ?? colors.gray400;
  const label = current?.name ?? 'Category';
  const icon = current?.icon ?? 'folder-outline';

  const handleTap = useCallback(() => {
    haptic('selection');
    scale.value = withSpring(0.9, SPRING_SNAPPY);
    setTimeout(() => {
      scale.value = withSpring(1, SPRING_SNAPPY);
    }, 80);
    setShowDropdown(true);
  }, [scale]);

  const handleSelect = useCallback((catId: string) => {
    haptic('selection');
    onChange(catId);
    setShowDropdown(false);
  }, [onChange]);

  return (
    <>
      <Pressable onPress={handleTap}>
        <Animated.View
          style={[
            styles.pill,
            { borderColor: color, backgroundColor: color + '14' },
            animStyle,
          ]}
        >
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Icon name={icon} size={12} color={color} />
          <Text style={[styles.pillText, { color, fontWeight: '600' }]}>
            {label}
          </Text>
          <Icon name="chevron-down" size={10} color={color} />
        </Animated.View>
      </Pressable>

      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowDropdown(false)}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Category</Text>
            {categories.map(cat => {
              const isSelected = cat.id === value;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                  onPress={() => handleSelect(cat.id)}
                >
                  <View style={[styles.dropdownDot, { backgroundColor: cat.color }]} />
                  <Icon name={cat.icon} size={16} color={isSelected ? cat.color : colors.gray500} />
                  <Text style={[
                    styles.dropdownLabel,
                    isSelected && { color: cat.color, fontWeight: '700' },
                  ]}>
                    {cat.name}
                  </Text>
                  {isSelected && (
                    <Icon name="checkmark" size={18} color={cat.color} style={styles.checkmark} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 15,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    width: '72%',
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.gray400,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    fontFamily: FontFamily,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
  },
  dropdownItemActive: {
    backgroundColor: c.gray50,
  },
  dropdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dropdownLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: c.text,
    flex: 1,
    fontFamily: FontFamily,
  },
  checkmark: {
    marginLeft: 'auto',
  },
});
