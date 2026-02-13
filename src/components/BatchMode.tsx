import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, Typography } from '../utils/colors';

interface BatchModeBarProps {
  selectedCount: number;
  onCompleteAll: () => void;
  onDeleteAll: () => void;
  onArchiveAll: () => void;
  onCancel: () => void;
}

/**
 * Feature 6: Batch Mode Toggle
 * 
 * Bottom sheet: White background, 60pt height, black text, 
 * slides up with 200ms ease-out.
 * Shows: "Complete all", "Delete all", "Archive all"
 */
export const BatchModeBar = memo(function BatchModeBar({
  selectedCount,
  onCompleteAll,
  onDeleteAll,
  onArchiveAll,
  onCancel,
}: BatchModeBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.countRow}>
        <Icon name="checkbox-outline" size={16} color={Colors.black} />
        <Text style={styles.countText}>
          {selectedCount === 0
            ? 'Select tasks'
            : `${selectedCount} task${selectedCount !== 1 ? 's' : ''} selected`}
        </Text>
      </View>
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, selectedCount === 0 && styles.actionButtonDisabled]}
          onPress={onCompleteAll}
          disabled={selectedCount === 0}
        >
          <Icon
            name="checkmark-circle-outline"
            size={18}
            color={selectedCount === 0 ? Colors.gray400 : '#22C55E'}
          />
          <Text style={[styles.actionText, selectedCount === 0 && styles.actionTextDisabled]}>
            Complete
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, selectedCount === 0 && styles.actionButtonDisabled]}
          onPress={onArchiveAll}
          disabled={selectedCount === 0}
        >
          <Icon
            name="archive-outline"
            size={18}
            color={selectedCount === 0 ? Colors.gray400 : '#F59E0B'}
          />
          <Text style={[styles.actionText, selectedCount === 0 && styles.actionTextDisabled]}>
            Archive
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, selectedCount === 0 && styles.actionButtonDisabled]}
          onPress={onDeleteAll}
          disabled={selectedCount === 0}
        >
          <Icon
            name="trash-outline"
            size={18}
            color={selectedCount === 0 ? Colors.gray400 : '#EF4444'}
          />
          <Text style={[styles.actionText, selectedCount === 0 && styles.actionTextDisabled]}>
            Delete
          </Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Icon name="close-outline" size={18} color={Colors.gray600} />
          <Text style={styles.cancelText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
});

interface BatchCheckboxProps {
  selected: boolean;
  onToggle: () => void;
}

export const BatchCheckbox = memo(function BatchCheckbox({
  selected,
  onToggle,
}: BatchCheckboxProps) {
  return (
    <Pressable style={styles.checkboxContainer} onPress={onToggle} hitSlop={8}>
      <Icon
        name={selected ? 'checkbox' : 'square-outline'}
        size={20}
        color={selected ? Colors.black : Colors.gray400}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    gap: 6,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text,
  },
  actionTextDisabled: {
    color: Colors.gray400,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
  cancelText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.gray600,
  },
  checkboxContainer: {
    marginRight: 8,
  },
});
