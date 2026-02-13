import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task, Priority, EnergyLevel } from '../types';
import { Colors, Spacing, Typography } from '../utils/colors';
import { formatDeadline } from '../utils/dateUtils';

interface TaskPreviewOverlayProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: string; color: string }> = {
  high: { label: 'High', icon: 'flag', color: '#EF4444' },
  medium: { label: 'Medium', icon: 'flag-outline', color: '#F59E0B' },
  low: { label: 'Low', icon: 'flag-outline', color: '#22C55E' },
  none: { label: 'None', icon: 'flag-outline', color: '#9E9E9E' },
};

const ENERGY_CONFIG: Record<EnergyLevel, { label: string; icon: string; color: string }> = {
  high: { label: 'High Focus', icon: 'flash', color: '#EF4444' },
  medium: { label: 'Medium Focus', icon: 'flash-outline', color: '#F59E0B' },
  low: { label: 'Low Focus', icon: 'flash-outline', color: '#22C55E' },
};

/**
 * Feature 3: Long-Press Preview
 * 
 * Frosted white overlay (90% opacity), centered card showing full task details.
 * 85% screen width, white background, subtle 2px gray border, 16pt padding.
 * Shows: Full title, description, deadline, priority, energy, subtask count.
 * Bottom: "Edit" and "Close" buttons.
 */
export const TaskPreviewOverlay = memo(function TaskPreviewOverlay({
  visible,
  task,
  onClose,
  onEdit,
  onAddSubtask,
  onDelete,
}: TaskPreviewOverlayProps) {
  if (!task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const energyConfig = ENERGY_CONFIG[task.energyLevel];
  const subtaskCount = task.childIds?.length ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Status badge */}
          {task.isCompleted && (
            <View style={styles.statusBadge}>
              <Icon name="checkmark-circle" size={14} color="#22C55E" />
              <Text style={styles.statusText}>Completed</Text>
            </View>
          )}

          {/* Full Title */}
          <Text style={styles.title}>{task.title}</Text>

          {/* Description */}
          {task.description ? (
            <Text style={styles.description}>{task.description}</Text>
          ) : (
            <Text style={styles.noDescription}>No description</Text>
          )}

          {/* Metadata pills */}
          <View style={styles.metaRow}>
            {/* Priority */}
            <View style={styles.metaPill}>
              <Icon name={priorityConfig.icon} size={12} color={priorityConfig.color} />
              <Text style={[styles.metaText, { color: priorityConfig.color }]}>
                {priorityConfig.label}
              </Text>
            </View>

            {/* Energy */}
            <View style={styles.metaPill}>
              <Icon name={energyConfig.icon} size={12} color={energyConfig.color} />
              <Text style={[styles.metaText, { color: energyConfig.color }]}>
                {energyConfig.label}
              </Text>
            </View>

            {/* Deadline */}
            {task.deadline && (
              <View style={styles.metaPill}>
                <Icon name="time-outline" size={12} color={Colors.gray600} />
                <Text style={styles.metaText}>
                  {formatDeadline(task.deadline)}
                </Text>
              </View>
            )}
          </View>

          {/* Subtask count */}
          {subtaskCount > 0 && (
            <View style={styles.subtaskInfo}>
              <Icon name="git-branch-outline" size={14} color={Colors.gray500} />
              <Text style={styles.subtaskText}>
                {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Estimate info */}
          {task.estimatedMinutes && (
            <View style={styles.subtaskInfo}>
              <Icon name="hourglass-outline" size={14} color={Colors.gray500} />
              <Text style={styles.subtaskText}>
                est. {task.estimatedMinutes} min
              </Text>
            </View>
          )}

          {/* Defer count */}
          {task.deferCount > 0 && (
            <View style={styles.subtaskInfo}>
              <Icon name="arrow-redo-outline" size={14} color="#F59E0B" />
              <Text style={[styles.subtaskText, { color: '#F59E0B' }]}>
                Deferred {task.deferCount}×
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => { onClose(); onEdit(task); }}
            >
              <Icon name="create-outline" size={16} color={Colors.white} />
              <Text style={styles.actionButtonText}>Edit</Text>
            </Pressable>
            {task.depth < 3 && !task.isCompleted && (
              <Pressable
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => { onClose(); onAddSubtask(task); }}
              >
                <Icon name="git-branch-outline" size={16} color={Colors.black} />
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Subtask</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={() => { onClose(); onDelete(task); }}
            >
              <Icon name="trash-outline" size={16} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.gray200,
    borderRadius: 8,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  noDescription: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.gray400,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.gray600,
    marginLeft: 4,
  },
  subtaskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subtaskText: {
    fontSize: 12,
    color: Colors.gray500,
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    backgroundColor: Colors.black,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.black,
  },
  actionButtonDanger: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  actionButtonTextSecondary: {
    color: Colors.black,
  },
});
