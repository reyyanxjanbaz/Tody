import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/** Web port of components/EmptyState — contextual, staggered fade-in. */
export function EmptyState({
  title,
  subtitle,
  icon,
  iconColor,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '80px var(--sp-xxxl) 0',
      }}
    >
      {icon && (
        <motion.div {...rise} transition={{ delay: 0.08, duration: 0.3 }} style={{ marginBottom: 'var(--sp-lg)' }}>
          <Icon name={icon} size={48} color={iconColor || 'var(--c-gray400)'} />
        </motion.div>
      )}
      <motion.div {...rise} transition={{ delay: 0.14, duration: 0.3 }} style={{ fontSize: 16, color: 'var(--c-gray600)' }}>
        {title}
      </motion.div>
      {subtitle && (
        <motion.div
          {...rise}
          transition={{ delay: 0.2, duration: 0.3 }}
          style={{ fontSize: 14, color: 'var(--c-gray500)', marginTop: 'var(--sp-sm)' }}
        >
          {subtitle}
        </motion.div>
      )}
      {actionLabel && onAction && (
        <motion.div {...rise} transition={{ delay: 0.26, duration: 0.3 }} style={{ marginTop: 'var(--sp-lg)' }}>
          <Pressable
            onPress={onAction}
            style={{
              padding: 'var(--sp-sm) var(--sp-xl)',
              background: 'var(--c-text)',
              color: 'var(--c-white)',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {actionLabel}
          </Pressable>
        </motion.div>
      )}
    </motion.div>
  );
}
