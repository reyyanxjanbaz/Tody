import { useAnimate } from 'framer-motion';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { haptic } from '../core/utils/haptics';
import { useTheme } from '../core/context/ThemeContext';

interface CheckboxProps {
  checked: boolean;
  locked?: boolean;
  onToggle: () => void;
  size?: number;
}

/**
 * Web port of ui/AnimatedCheckbox — the border morphs into a filled circle and
 * the checkmark draws in with a bouncy spring + celebration pop. Locked taps
 * shake and fire a warning haptic instead of toggling.
 */
export function Checkbox({ checked, locked = false, onToggle, size = 20 }: CheckboxProps) {
  const { isDark, colors } = useTheme();
  const [scope, animate] = useAnimate();

  const fill = isDark ? '#FFFFFF' : '#000000';
  const check = isDark ? '#000000' : '#FFFFFF';
  const emptyBorder = isDark
    ? locked
      ? colors.gray200
      : 'rgba(255,255,255,0.5)'
    : locked
    ? colors.gray200
    : colors.gray400;
  const emptyBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';

  // Celebration pop when transitioning into checked
  useEffect(() => {
    if (checked && scope.current) {
      animate(
        scope.current,
        { scale: [1, 1.25, 1] },
        { duration: 0.28, times: [0, 0.4, 1], ease: 'easeOut' },
      );
    }
  }, [checked, animate, scope]);

  const handleClick = () => {
    if (locked) {
      haptic('warning');
      if (scope.current) {
        animate(
          scope.current,
          { x: [0, 5, -5, 4, -4, 2, 0] },
          { duration: 0.21, ease: 'linear' },
        );
      }
      return;
    }
    haptic('success');
    onToggle();
  };

  return (
    <motion.button
      ref={scope}
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.8 }}
      animate={{
        backgroundColor: checked ? fill : emptyBg,
        borderColor: checked ? fill : emptyBorder,
        borderWidth: checked ? 0 : 1.5,
        borderRadius: checked ? size * 0.5 : size * 0.15,
      }}
      transition={{ type: 'spring', damping: 12, stiffness: 200, mass: 0.7 }}
      style={{
        width: size,
        height: size,
        borderStyle: 'solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
      }}
      aria-checked={checked}
      aria-label={locked ? 'Complete subtasks to unlock' : checked ? 'Mark task incomplete' : 'Mark task complete'}
      role="checkbox"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
        <motion.path
          d="M5 12.5 L10 17.5 L19 7"
          stroke={check}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ type: 'spring', damping: 14, stiffness: 220, mass: 0.6 }}
        />
      </svg>
    </motion.button>
  );
}
