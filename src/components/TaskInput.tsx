import React, { memo, useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
} from 'react-native';
import { Colors, Spacing, Typography } from '../utils/colors';

interface TaskInputProps {
  onSubmit: (text: string) => void;
}

export const TaskInput = memo(function TaskInput({ onSubmit }: TaskInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) { return; }
    onSubmit(trimmed);
    setValue('');
  }, [value, onSubmit]);

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder='Add a task... try "buy milk tomorrow"'
        placeholderTextColor={Colors.gray400}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        blurOnSubmit={false}
        autoCorrect={false}
        autoCapitalize="sentences"
      />
      {value.trim().length > 0 && (
        <Pressable
          style={styles.addButton}
          onPress={handleSubmit}
          hitSlop={8}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    height: 52,
    ...Typography.body,
    color: Colors.text,
  },
  addButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.black,
    borderRadius: 2,
    marginLeft: Spacing.sm,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 22,
    marginTop: -1,
  },
});
