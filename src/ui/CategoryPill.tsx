import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { haptic } from '../core/utils/haptics';
import { useTheme } from '../core/context/ThemeContext';
import type { Category } from '../core/types';

interface CategoryPillProps {
  value: string;
  categories: Category[]; // assignable categories (no overview)
  onChange: (categoryId: string) => void;
}

/** Web port of components/CategoryPill — tappable pill + selection dropdown. */
export function CategoryPill({ value, categories, onChange }: CategoryPillProps) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const current = categories.find((c) => c.id === value);
  const color = current?.color ?? 'var(--c-text)';
  const label = current?.name ?? 'Category';
  const icon = current?.icon ?? 'folder-outline';
  const selText = isDark ? '#ffffff' : '#000000';

  const select = (catId: string) => {
    haptic('selection');
    onChange(catId);
    setOpen(false);
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          haptic('selection');
          setOpen(true);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 30,
          padding: '0 10px',
          border: `1px solid ${color}`,
          borderRadius: 15,
          background: `${color}14`,
          color,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />
        <Icon name={icon} size={12} color={color} />
        <span>{label}</span>
        <Icon name="chevron-down" size={10} color={color} />
      </motion.button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div style={{ padding: '12px 8px' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--c-text-secondary)',
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              padding: '0 12px 8px',
            }}
          >
            Category
          </div>
          {categories.map((cat) => {
            const selected = cat.id === value;
            return (
              <button
                key={cat.id}
                onClick={() => select(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '11px 12px',
                  borderRadius: 10,
                  background: selected ? (isDark ? '#1a1a1a' : '#f0f0f0') : 'transparent',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 4, background: cat.color }} />
                <Icon name={cat.icon} size={16} color={selected ? selText : 'var(--c-text-secondary)'} />
                <span
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    fontSize: 15,
                    fontWeight: selected ? 700 : 500,
                    color: selected ? selText : 'var(--c-text)',
                  }}
                >
                  {cat.name}
                </span>
                {selected && <Icon name="checkmark" size={18} color={selText} />}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
