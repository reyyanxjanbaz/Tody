import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
  taskTitle: string;
}

/**
 * Phase 3.5 — "Break it down". Offered on a heavy task (long estimate or high
 * energy) where the wall is activation energy, not effort. Rapid-fire entry:
 * type a step, hit Enter, keep going. The input stays focused and the list
 * grows in place, so a big scary task becomes a short checklist without ever
 * leaving the flow.
 */
export function ChunkAssistant({ open, onClose, onAdd, taskTitle }: Props) {
  const [value, setValue] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAdded([]);
      setValue('');
      // let the sheet finish animating in before grabbing focus
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    haptic('selection');
    onAdd(trimmed);
    setAdded((prev) => [...prev, trimmed]);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 16px 16px' }}>
        <div style={{ fontSize: 17, fontWeight: 700, paddingBottom: 2 }}>Break it down</div>
        <div style={{ fontSize: 13, color: 'var(--c-text-secondary)', paddingBottom: 14, lineHeight: 1.4 }}>
          What are the small steps of “{taskTitle}”? Add them one at a time — hit Enter and keep going.
        </div>

        {added.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12 }}>
            <AnimatePresence initial={false}>
              {added.map((step, i) => (
                <motion.div
                  key={`${step}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}
                >
                  <Icon name="checkmark-circle" size={16} color="#22C55E" />
                  <span>{step}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-surface)', border: '1px solid var(--c-gray200)', borderRadius: 'var(--r-input)', padding: '0 12px', height: 50 }}>
          <Icon name="add-outline" size={20} color={value.trim() ? 'var(--c-text)' : 'var(--c-gray400)'} />
          <input
            ref={inputRef}
            value={value}
            placeholder="A small step…"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            style={{ flex: 1, height: '100%', fontSize: 16, background: 'transparent' }}
          />
          {value.trim() && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={commit} style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--c-surface-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="arrow-up" size={18} color="#fff" />
            </motion.button>
          )}
        </div>

        <button
          onClick={onClose}
          style={{ display: 'block', margin: '16px auto 0', padding: '10px 24px', fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}
        >
          {added.length > 0 ? `Done · ${added.length} step${added.length > 1 ? 's' : ''}` : 'Close'}
        </button>
      </div>
    </Sheet>
  );
}
