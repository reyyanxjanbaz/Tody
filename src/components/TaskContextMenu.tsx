import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import { Spacing, Typography, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';

interface TaskContextMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddSubtask: () => void;
  onDelete: () => void;
  canAddSubtask: boolean;
}

export const TaskContextMenu = memo(function TaskContextMenu({
  visible,
  onClose,
  onAddSubtask,
  onDelete,
  canAddSubtask,
}: TaskContextMenuProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const handleAddSubtask = useCallback(() => {
    onClose();
    onAddSubtask();
  }, [onClose, onAddSubtask]);

  const handleDelete = useCallback(() => {
    onClose();
    onDelete();
  }, [onClose, onDelete]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.card}>
          {canAddSubtask ? (
            <Pressable style={styles.menuItem} onPress={handleAddSubtask}>
              <Text style={styles.menuText}>Add subtask</Text>
            </Pressable>
          ) : (
            <View style={[styles.menuItem, styles.menuItemDisabled]}>
              <Text style={styles.menuTextDisabled}>Add subtask (max depth)</Text>
            </View>
          )}

          <View style={styles.separator} />

          <Pressable style={styles.menuItem} onPress={handleDelete}>
            <Text style={styles.menuText}>Delete task</Text>
          </Pressable>

          <View style={styles.separator} />

          <Pressable style={styles.menuItem} onPress={onClose}>
            <Text style={[styles.menuText, styles.cancelText]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 200,
    backgroundColor: c.white,
    borderRadius: 4,
    shadowColor: c.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
  menuItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuText: {
    ...Typography.body,
    color: c.text,
  },
  menuTextDisabled: {
    ...Typography.body,
    color: c.gray500,
  },
  cancelText: {
    color: c.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: c.border,
  },
});
