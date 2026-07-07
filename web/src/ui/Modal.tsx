import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SPRING_SNAPPY } from '../theme/motion';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  zIndex: 1000,
};

/** Centered card modal (fade + scale). Backdrop tap closes. */
export function Modal({ open, onClose, children }: BaseProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          style={{ ...backdrop, alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-xxl)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={SPRING_SNAPPY}
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'var(--c-surface)',
              borderRadius: 'var(--r-card)',
              boxShadow: 'var(--shadow-floating)',
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Bottom sheet (slide up). Backdrop tap or swipe-down closes. */
export function Sheet({ open, onClose, children }: BaseProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          style={{ ...backdrop, alignItems: 'flex-end', justifyContent: 'center' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '88vh',
              background: 'var(--c-background)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: 'var(--shadow-floating)',
              paddingBottom: 'var(--safe-bottom)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                background: 'var(--c-border)',
                margin: '10px auto 4px',
                flexShrink: 0,
              }}
            />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
