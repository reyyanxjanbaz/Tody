import React, { memo, useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Modal,
  StyleSheet,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInbox } from '../context/InboxContext';
import { Spacing, BorderRadius, FontFamily, type ThemeColors } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY, PRESS_SCALE } from '../utils/animations';

export const QuickCaptureFAB = memo(function QuickCaptureFAB() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { captureTask } = useInbox();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  // ── FAB spring animation ──────────────────────────────────────────────
  const fabScale = useSharedValue(1);
  const fabRotation = useSharedValue(0);

  const fabTap = Gesture.Tap()
    .onBegin(() => {
      'worklet';
      fabScale.value = withSpring(PRESS_SCALE, SPRING_SNAPPY);
    })
    .onFinalize((_e, success) => {
      'worklet';
      fabScale.value = withSpring(1, SPRING_SNAPPY);
      if (success) {
        fabRotation.value = withSpring(0.125, SPRING_SNAPPY, () => {
          fabRotation.value = withSpring(0, SPRING_SNAPPY);
        });
        runOnJS(openModal)();
      }
    });

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: fabScale.value },
      { rotate: `${fabRotation.value * 360}deg` },
    ],
  }));

  // ── Modal shake for empty input ───────────────────────────────────────
  const shakeX = useSharedValue(0);

  const shakeInputStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const shakeInput = useCallback(() => {
    haptic('warning');
    shakeX.value = withSequence(
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeX]);

  // ── Handlers ──────────────────────────────────────────────────────────
  function openModal() {
    haptic('light');
    setVisible(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const closeModal = useCallback(() => {
    Keyboard.dismiss();
    setVisible(false);
    setValue('');
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      shakeInput();
      return;
    }
    haptic('success');
    captureTask(trimmed);
    closeModal();
  }, [value, captureTask, closeModal, shakeInput]);

  return (
    <>
      {/* FAB – spring-animated tap */}
      <GestureDetector gesture={fabTap}>
        <Animated.View
          style={[
            styles.fab,
            { bottom: insets.bottom + 24, right: 24 },
            fabStyle,
          ]}>
          <Text style={styles.fabIcon}>+</Text>
        </Animated.View>
      </GestureDetector>

      {/* Capture Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={closeModal}>
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          style={styles.overlay}>
          <Pressable style={styles.overlayTouch} onPress={closeModal} />
          <Animated.View
            entering={FadeIn.duration(150)}
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + Spacing.lg },
            ]}>
            <Animated.View style={shakeInputStyle}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.gray400}
                value={value}
                onChangeText={setValue}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="sentences"
                multiline={false}
              />
            </Animated.View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={closeModal}
                hitSlop={8}
                style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                hitSlop={8}
                style={styles.modalButton}>
                <Text style={[styles.modalButtonText, styles.modalSubmitText]}>
                  Capture
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  fabIcon: {
    color: c.white,
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 32,
    marginTop: -1,
    fontFamily: FontFamily,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: c.surface,
    borderTopLeftRadius: BorderRadius.card,
    borderTopRightRadius: BorderRadius.card,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  input: {
    fontSize: 17,
    fontWeight: '400',
    color: c.text,
    backgroundColor: c.gray50,
    borderRadius: BorderRadius.input,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
    fontFamily: FontFamily,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
  },
  modalButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: BorderRadius.pill,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: FontFamily,
  },
  modalSubmitText: {
    color: c.white,
    fontWeight: '700',
    backgroundColor: c.surfaceDark,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
});
