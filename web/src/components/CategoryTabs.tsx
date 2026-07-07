import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import type { Category } from '../core/types';

interface Props {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  onAddPress: () => void;
  onManagePress: () => void;
}

/** Web port of EnergyFilter's CategoryTabs — scrollable pill tabs + add/manage. */
export function CategoryTabs({ categories, activeCategory, onCategoryChange, onAddPress, onManagePress }: Props) {
  const sorted = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div style={{ background: 'var(--c-background)', paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--c-gray100)' }}>
        <div className="tody-scroll" style={{ flex: 1, display: 'flex', gap: 20, overflowX: 'auto', padding: '0 8px 0 16px' }}>
          {sorted.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  haptic('selection');
                  onCategoryChange(cat.id);
                }}
                style={{ position: 'relative', paddingBottom: 12, flexShrink: 0 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {cat.id !== 'overview' && (
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: cat.color }} />
                  )}
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--c-text)' : 'var(--c-gray400)',
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {cat.name}
                  </span>
                </span>
                {active && (
                  <motion.span
                    layoutId="cat-underline"
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      left: 0,
                      right: 0,
                      height: 3,
                      borderRadius: 1.5,
                      background: cat.id !== 'overview' ? cat.color : 'var(--c-text)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px 12px' }}>
          <button aria-label="Add category" onClick={() => { haptic('light'); onAddPress(); }} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="add" size={18} color="var(--c-gray500)" />
          </button>
          <button aria-label="Manage categories" onClick={() => { haptic('light'); onManagePress(); }} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pencil-outline" size={15} color="var(--c-gray500)" />
          </button>
        </div>
      </div>
    </div>
  );
}
