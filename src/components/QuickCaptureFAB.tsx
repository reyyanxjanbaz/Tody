import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInbox } from '../context/InboxContext';
import { Colors, Spacing } from '../utils/colors';

export const QuickCaptureFAB = memo(function QuickCaptureFAB() {
  const insets = useSafeAreaInsets();
  const { captureTask } = useInbox();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const openModal = useCallback(() => {
    setVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      inputRef.current?.focus();
    });
  }, [fadeAnim]);

  const closeModal = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setValue('');
    });
  }, [fadeAnim]);

  const shakeInput = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      shakeInput();
      return;
    }
    captureTask(trimmed);
    closeModal();
  }, [value, captureTask, closeModal, shakeInput]);

  return (
    <>
      {/* FAB */}
      <Pressable
        style={[
          styles.fab,
          { bottom: insets.bottom + 24, right: 24 },
        ]}
        onPress={openModal}
        hitSlop={8}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* Capture Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={closeModal}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Pressable style={styles.overlayTouch} onPress={closeModal} />
          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: fadeAnim,
                transform: [{ translateX: shakeAnim }],
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="What's on your mind?"
              placeholderTextColor={Colors.gray400}
              value={value}
              onChangeText={setValue}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              autoCorrect={false}
              autoCapitalize="sentences"
              multiline={false}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} hitSlop={8} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} hitSlop={8} style={styles.modalButton}>
                <Text style={[styles.modalButtonText, styles.modalSubmitText]}>Capture</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  fabIcon: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
    marginTop: -1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  input: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  modalButton: {
    paddingVertical: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  modalSubmitText: {
    color: Colors.black,
    fontWeight: '600',
  },
});
