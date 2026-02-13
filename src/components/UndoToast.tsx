import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../utils/haptics';
import { SPRING_SNAPPY } from '../utils/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_WIDTH = SCREEN_WIDTH * 0.9;
const AUTO_DISMISS_MS = 5000;

// ── Types ──────────────────────────────────────────────────────────────────

interface UndoAction {
  id: string;
  message: string;
  icon?: string;
  iconColor?: string;
  onUndo: () => void;
  createdAt: number;
}

interface UndoContextType {
  showUndo: (
    message: string,
    onUndo: () => void,
    options?: { icon?: string; iconColor?: string },
  ) => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

// ── Toast Component (Reanimated 3 + Gesture Handler v2) ───────────────────

interface UndoToastProps {
  action: UndoAction;
  index: number;
  onDismiss: (id: string) => void;
}

function UndoToast({ action, index, onDismiss }: UndoToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(80);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const progress = useSharedValue(1);
  const dismissed = useSharedValue(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback wrappers for runOnJS
  const dismissCallback = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss(action.id);
  }, [action.id, onDismiss]);

  // Slide in on mount + start countdown
  useEffect(() => {
    translateY.value = withSpring(0, SPRING_SNAPPY);
    opacity.value = withTiming(1, { duration: 150 });
    progress.value = withTiming(0, {
      duration: AUTO_DISMISS_MS,
      easing: Easing.linear,
    });

    timerRef.current = setTimeout(() => {
      dismissToast();
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    translateY.value = withTiming(80, { duration: 200 });
    opacity.value = withTiming(0, { duration: 150 }, finished => {
      'worklet';
      if (finished) {
        runOnJS(dismissCallback)();
      }
    });
  }, [dismissCallback, translateY, opacity]);

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    haptic('success');
    action.onUndo();
    translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, finished => {
      'worklet';
      if (finished) {
        runOnJS(dismissCallback)();
      }
    });
  }, [action, dismissCallback, translateX, opacity]);

  // ── Swipe-to-dismiss gesture ──────────────────────────────────────────
  const pan = Gesture.Pan()
    .activeOffsetY(5)
    .onUpdate(event => {
      'worklet';
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd(event => {
      'worklet';
      if (dismissed.value) return;
      if (event.translationY > 30 || event.velocityY > 500) {
        dismissed.value = true;
        translateY.value = withTiming(80, { duration: 200 });
        opacity.value = withTiming(0, { duration: 150 }, finished => {
          if (finished) {
            runOnJS(dismissCallback)();
          }
        });
      } else {
        translateY.value = withSpring(0, SPRING_SNAPPY);
      }
    });

  // ── Animated styles ───────────────────────────────────────────────────
  const toastStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  /** Progress bar shrinks from right to left via translateX */
  const progressBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * TOAST_WIDTH }],
  }));

  const bottomOffset = insets.bottom + 16 + index * 68;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.toast, { bottom: bottomOffset }, toastStyle]}>
        <View style={styles.toastContent}>
          {action.icon && (
            <Icon
              name={action.icon}
              size={16}
              color={action.iconColor || '#FFFFFF'}
              style={styles.toastIcon}
            />
          )}
          <Text style={styles.toastMessage} numberOfLines={1}>
            {action.message}
          </Text>
          <Pressable style={styles.undoButton} onPress={handleUndo}>
            <Icon name="arrow-undo-outline" size={14} color="#FFFFFF" />
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        </View>
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressBar, progressBarStyle]} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────

const MAX_TOASTS = 3;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<UndoAction[]>([]);

  const showUndo = useCallback(
    (
      message: string,
      onUndo: () => void,
      options?: { icon?: string; iconColor?: string },
    ) => {
      const newAction: UndoAction = {
        id: `${Date.now()}-${Math.random()}`,
        message,
        icon: options?.icon,
        iconColor: options?.iconColor,
        onUndo,
        createdAt: Date.now(),
      };

      setToasts(prev => {
        const updated = [newAction, ...prev];
        return updated.slice(0, MAX_TOASTS);
      });
    },
    [],
  );

  const handleDismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {/* Toast stack */}
      {toasts.map((toast, i) => (
        <UndoToast
          key={toast.id}
          action={toast}
          index={i}
          onDismiss={handleDismiss}
        />
      ))}
    </UndoContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useUndo(): UndoContextType {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: '5%',
    width: '90%',
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
  toastIcon: {
    marginRight: 8,
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    gap: 4,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
