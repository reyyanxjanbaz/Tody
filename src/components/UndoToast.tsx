import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { SPRING_SNAPPY } from '../theme/motion';

interface UndoAction {
  id: string;
  message: string;
  icon?: string;
  iconColor?: string;
  onUndo: () => void;
}

interface UndoContextType {
  showUndo: (message: string, onUndo: () => void, options?: { icon?: string; iconColor?: string }) => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 3;

function Toast({ action, index, onDismiss }: { action: UndoAction; index: number; onDismiss: (id: string) => void }) {
  const undo = () => {
    haptic('success');
    action.onUndo();
    onDismiss(action.id);
  };

  return (
    // Outer: centering + enter/exit slide (no transform conflict with drag)
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={SPRING_SNAPPY}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 16px',
        bottom: `calc(var(--safe-bottom) + 16px + ${index * 68}px)`,
        zIndex: 1200,
        pointerEvents: 'none',
      }}
    >
      {/* Inner: draggable swipe-to-dismiss */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 30 || info.velocity.y > 500) onDismiss(action.id);
        }}
        style={{
          width: 'min(100%, 440px)',
          background: '#000000',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'auto',
        }}
      >
      <div style={{ display: 'flex', alignItems: 'center', height: 56, padding: '0 16px' }}>
        {action.icon && (
          <span style={{ marginRight: 8, display: 'flex' }}>
            <Icon name={action.icon} size={16} color={action.iconColor || '#FFFFFF'} />
          </span>
        )}
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 500,
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {action.message}
        </span>
        <button
          onClick={undo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            marginLeft: 8,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Icon name="arrow-undo-outline" size={14} color="#FFFFFF" />
          Undo
        </button>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}>
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
          onAnimationComplete={() => onDismiss(action.id)}
          style={{ height: 3, background: 'rgba(255,255,255,0.4)', transformOrigin: 'left' }}
        />
      </div>
      </motion.div>
    </motion.div>
  );
}

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<UndoAction[]>([]);

  const showUndo = useCallback<UndoContextType['showUndo']>((message, onUndo, options) => {
    const action: UndoAction = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      icon: options?.icon,
      iconColor: options?.iconColor,
      onUndo,
    };
    setToasts((prev) => [action, ...prev].slice(0, MAX_TOASTS));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {createPortal(
        <AnimatePresence>
          {toasts.map((t, i) => (
            <Toast key={t.id} action={t} index={i} onDismiss={dismiss} />
          ))}
        </AnimatePresence>,
        document.body,
      )}
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoContextType {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}
