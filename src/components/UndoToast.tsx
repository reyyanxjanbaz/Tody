import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  showUndo: (message: string, onUndo: () => void, options?: { icon?: string; iconColor?: string }) => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

// ── Toast Component ────────────────────────────────────────────────────────

interface UndoToastProps {
  action: UndoAction;
  index: number;
  onDismiss: (id: string) => void;
}

function UndoToast({ action, index, onDismiss }: UndoToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(80)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss timer
  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar countdown
    Animated.timing(progressWidth, {
      toValue: 0,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    // Auto-dismiss after 5 seconds
    timerRef.current = setTimeout(() => {
      dismissToast();
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 80,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(action.id);
    });
  }, [action.id, onDismiss, translateY, opacity]);

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    action.onUndo();
    // Slide out with a satisfying animation
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(action.id);
    });
  }, [action, onDismiss, translateX, opacity]);

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 30 || gestureState.vy > 0.5) {
          // Dismiss
          dismissToast();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            damping: 20,
            stiffness: 300,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const bottomOffset = insets.bottom + 16 + (index * 68);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.toast,
        {
          bottom: bottomOffset,
          opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    >
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
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────

const MAX_TOASTS = 3;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<UndoAction[]>([]);

  const showUndo = useCallback(
    (message: string, onUndo: () => void, options?: { icon?: string; iconColor?: string }) => {
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
        // Cap at MAX_TOASTS
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
      {toasts.map((toast, index) => (
        <UndoToast
          key={toast.id}
          action={toast}
          index={index}
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
    // Shadow
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
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
