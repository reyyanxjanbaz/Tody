import { forwardRef, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { SPRING_SNAPPY, PRESS_SCALE } from '../theme/motion';
import { haptic } from '../core/utils/haptics';

type HapticStyle =
  | 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

interface PressableProps extends Omit<HTMLMotionProps<'button'>, 'onPress'> {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Haptic fired on press-in. null disables. Default 'light'. */
  hapticStyle?: HapticStyle | null;
  pressScale?: number;
  longPressMs?: number;
  children?: React.ReactNode;
}

/**
 * Web port of ui/AnimatedPressable — spring scale-down on press, optional
 * haptic + long-press. A <button> for accessibility (keyboard/enter, focus).
 */
export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  {
    onPress,
    onLongPress,
    disabled = false,
    hapticStyle = 'light',
    pressScale = PRESS_SCALE,
    longPressMs = 350,
    children,
    style,
    ...rest
  },
  ref,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    if (disabled) return;
    if (hapticStyle) haptic(hapticStyle);
    longFired.current = false;
    if (onLongPress) {
      timer.current = setTimeout(() => {
        longFired.current = true;
        haptic('medium');
        onLongPress();
      }, longPressMs);
    }
  }, [disabled, hapticStyle, onLongPress, longPressMs]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      clear();
      if (disabled) return;
      // Suppress the click that follows a long-press
      if (longFired.current) {
        longFired.current = false;
        e.preventDefault();
        return;
      }
      onPress?.();
    },
    [clear, disabled, onPress],
  );

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: pressScale }}
      transition={SPRING_SNAPPY}
      onPointerDown={handlePointerDown}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'manipulation',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
