/**
 * PromptModal — cross-platform replacement for Alert.prompt (iOS-only).
 * Renders a lightweight modal with a single TextInput, Cancel, and Submit buttons.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontFamily, BorderRadius } from '../../utils/colors';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  keyboardType?: 'default' | 'number-pad';
  onSubmit: (value: string) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function PromptModal({
  visible,
  title,
  message,
  defaultValue = '',
  keyboardType = 'default',
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: Props) {
  const { colors } = useTheme();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      // Small delay so the modal is mounted before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible, defaultValue]);

  const handleSubmit = () => {
    onSubmit(value);
    setValue('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          ) : null}
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={value}
            onChangeText={setValue}
            keyboardType={keyboardType}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.buttons}>
            <Pressable onPress={onCancel} style={styles.btn} hitSlop={8}>
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSubmit} style={styles.btn} hitSlop={8}>
              <Text style={[styles.btnText, { color: colors.activeState }]}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '82%',
    borderRadius: BorderRadius.card,
    padding: 22,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  title: {
    fontSize: 17,
    fontFamily: FontFamily,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    fontFamily: FontFamily,
    marginBottom: 12,
    lineHeight: 18,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.input,
    fontFamily: FontFamily,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginTop: 8,
    marginBottom: 18,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  btnText: {
    fontSize: 15,
    fontFamily: FontFamily,
    fontWeight: '600',
  },
});
