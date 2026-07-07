import { Sheet } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { useTheme } from '../core/context/ThemeContext';
import type { SortOption } from '../core/types';
import { SORT_OPTIONS } from '../core/utils/sortTasks';

interface Props {
  open: boolean;
  current: SortOption;
  onSelect: (option: SortOption) => void;
  onClose: () => void;
}

/** Web port of native SortDropdown — 7 explicit sort orders in a bottom sheet. */
export function SortDropdown({ open, current, onSelect, onClose }: Props) {
  const { isDark } = useTheme();
  const selText = isDark ? '#fff' : '#000';

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 8px 16px' }}>
        <div
          style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
            color: 'var(--c-text-secondary)', padding: '4px 12px 8px',
          }}
        >
          Sort by
        </div>
        {SORT_OPTIONS.map((opt) => {
          const selected = opt.key === current;
          return (
            <button
              key={opt.key}
              onClick={() => { haptic('selection'); onSelect(opt.key); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 12px', borderRadius: 10,
                background: selected ? (isDark ? '#1a1a1a' : '#f0f0f0') : 'transparent',
              }}
            >
              <Icon name={opt.icon} size={18} color={selected ? selText : 'var(--c-text-secondary)'} />
              <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: selected ? 700 : 500, color: selected ? selText : 'var(--c-text)' }}>
                {opt.label}
              </span>
              {selected && <Icon name="checkmark" size={18} color={selText} />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
