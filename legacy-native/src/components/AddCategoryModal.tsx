import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { Spacing, Typography, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';

const ICON_OPTIONS = [
  'briefcase-outline',
  'school-outline',
  'home-outline',
  'fitness-outline',
  'code-slash-outline',
  'musical-notes-outline',
  'cart-outline',
  'book-outline',
  'airplane-outline',
  'cafe-outline',
  'game-controller-outline',
  'leaf-outline',
  'bulb-outline',
  'hammer-outline',
  'heart-outline',
  'star-outline',
];

const COLOR_OPTIONS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

interface AddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, icon: string, color: string) => void;
}

export const AddCategoryModal = memo(function AddCategoryModal({
  visible,
  onClose,
  onCreate,
}: AddCategoryModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('briefcase-outline');
  const [color, setColor] = useState('#3B82F6');

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    haptic('success');
    onCreate(trimmed, icon, color);
    setName('');
    setIcon('briefcase-outline');
    setColor('#3B82F6');
  }, [name, icon, color, onCreate]);

  const handleClose = useCallback(() => {
    setName('');
    setIcon('briefcase-outline');
    setColor('#3B82F6');
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
          <Text style={styles.title}>New Category</Text>

          {/* Name input */}
          <TextInput
            style={styles.input}
            placeholder="Category name"
            placeholderTextColor={colors.gray400}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={20}
            returnKeyType="done"
          />

          {/* Icon picker */}
          <Text style={styles.sectionLabel}>Icon</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerRow}
          >
            {ICON_OPTIONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => { haptic('selection'); setIcon(ic); }}
                style={[styles.iconChoice, icon === ic && { borderColor: color, backgroundColor: color + '18' }]}
              >
                <Icon name={ic} size={20} color={icon === ic ? color : colors.gray500} />
              </Pressable>
            ))}
          </ScrollView>

          {/* Color picker */}
          <Text style={styles.sectionLabel}>Color</Text>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map((c) => (
              <Pressable
                key={c}
                onPress={() => { haptic('selection'); setColor(c); }}
                style={[styles.colorChoice, { backgroundColor: c }, color === c && styles.colorChoiceActive]}
              >
                {color === c && <Icon name="checkmark" size={14} color="#FFF" />}
              </Pressable>
            ))}
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <View style={[styles.previewDot, { backgroundColor: color }]} />
            <Icon name={icon} size={16} color={color} />
            <Text style={[styles.previewName, { color }]}>{name || 'Preview'}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={styles.createText}>Create</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
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
    width: '88%',
    backgroundColor: c.surface,
    borderRadius: BorderRadius.card,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: {
    ...Typography.heading,
    color: c.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: c.gray200,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: c.text,
    backgroundColor: c.gray50,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: c.gray500,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    fontFamily: FontFamily,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  iconChoice: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.gray200,
    backgroundColor: c.gray50,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorChoice: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorChoiceActive: {
    borderWidth: 3,
    borderColor: c.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gray200,
    justifyContent: 'center',
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewName: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  cancelText: {
    ...Typography.body,
    color: c.textTertiary,
  },
  createBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: c.surfaceDark,
    borderRadius: BorderRadius.button,
  },
  createBtnDisabled: {
    opacity: 0.3,
  },
  createText: {
    ...Typography.body,
    color: c.white,
    fontWeight: '600',
  },
});
