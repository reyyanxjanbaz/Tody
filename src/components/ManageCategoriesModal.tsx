import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../utils/colors';
import { Category } from '../types';
import { haptic } from '../utils/haptics';

interface ManageCategoriesModalProps {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export const ManageCategoriesModal = memo(function ManageCategoriesModal({
  visible,
  categories,
  onClose,
  onRename,
  onDelete,
  onReorder,
}: ManageCategoriesModalProps) {
  // Sort for display (by order)
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  // Movable = exclude overview
  const movable = sorted.filter(c => c.id !== 'overview');

  const handleMoveUp = useCallback((catId: string) => {
    const idx = movable.findIndex(c => c.id === catId);
    if (idx <= 0) return;
    haptic('selection');
    const newOrder = [...movable];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    // Overview stays at index 0, rest follow
    onReorder(['overview', ...newOrder.map(c => c.id)]);
  }, [movable, onReorder]);

  const handleMoveDown = useCallback((catId: string) => {
    const idx = movable.findIndex(c => c.id === catId);
    if (idx < 0 || idx >= movable.length - 1) return;
    haptic('selection');
    const newOrder = [...movable];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    onReorder(['overview', ...newOrder.map(c => c.id)]);
  }, [movable, onReorder]);

  const handleRename = useCallback((cat: Category) => {
    if (cat.id === 'overview') return;
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Rename Category',
        `Enter new name for "${cat.name}"`,
        (text) => {
          if (text && text.trim()) {
            onRename(cat.id, text.trim());
          }
        },
        'plain-text',
        cat.name,
      );
    } else {
      // Android: simple alert with instructions
      Alert.alert('Rename', `Current name: "${cat.name}"\n\nPlease use the category settings to rename on Android.`);
    }
  }, [onRename]);

  const handleDelete = useCallback((cat: Category) => {
    if (cat.id === 'overview') return;
    Alert.alert(
      'Delete Category',
      `Delete "${cat.name}"? Tasks in this category will be moved to Personal.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            haptic('medium');
            onDelete(cat.id);
          },
        },
      ],
    );
  }, [onDelete]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
          <Text style={styles.title}>Manage Categories</Text>

          {/* Overview (non-editable) */}
          <View style={styles.row}>
            <Icon name="grid-outline" size={18} color={Colors.gray400} />
            <Text style={styles.catName}>Overview</Text>
            <Text style={styles.lockedBadge}>Locked</Text>
          </View>

          {/* Editable categories */}
          {movable.map((cat, idx) => (
            <View key={cat.id} style={styles.row}>
              <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
              <Icon name={cat.icon} size={16} color={cat.color} style={{ marginRight: 6 }} />
              <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>

              <View style={styles.rowActions}>
                {/* Move up */}
                <Pressable
                  onPress={() => handleMoveUp(cat.id)}
                  hitSlop={6}
                  style={[styles.smallBtn, idx === 0 && styles.btnDisabled]}
                  disabled={idx === 0}
                >
                  <Icon name="chevron-up" size={16} color={idx === 0 ? Colors.gray200 : Colors.gray500} />
                </Pressable>

                {/* Move down */}
                <Pressable
                  onPress={() => handleMoveDown(cat.id)}
                  hitSlop={6}
                  style={[styles.smallBtn, idx === movable.length - 1 && styles.btnDisabled]}
                  disabled={idx === movable.length - 1}
                >
                  <Icon name="chevron-down" size={16} color={idx === movable.length - 1 ? Colors.gray200 : Colors.gray500} />
                </Pressable>

                {/* Rename */}
                <Pressable onPress={() => handleRename(cat)} hitSlop={6} style={styles.smallBtn}>
                  <Icon name="pencil-outline" size={15} color={Colors.gray500} />
                </Pressable>

                {/* Delete */}
                <Pressable onPress={() => handleDelete(cat)} hitSlop={6} style={styles.smallBtn}>
                  <Icon name="trash-outline" size={15} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}

          {/* Close */}
          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '88%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    ...Shadows.floating,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  title: {
    ...Typography.heading,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray100,
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  lockedBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray400,
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  smallBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.3,
  },
  doneBtn: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceDark,
    borderRadius: BorderRadius.button,
    alignItems: 'center',
  },
  doneText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});
