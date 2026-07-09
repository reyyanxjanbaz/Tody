import { useState } from 'react';
import { Sheet } from '../ui/Modal';
import { PromptModal } from '../ui/PromptModal';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import type { Category } from '../core/types';

interface Props {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

/**
 * Web port of native ManageCategoriesModal. Rename, delete, and reorder the
 * user's categories from one place (the tab bar's pencil button), instead of
 * bouncing to Settings. "Overview" is fixed and excluded.
 */
export function ManageCategoriesModal({ open, categories, onClose, onRename, onDelete, onReorder }: Props) {
  const [renaming, setRenaming] = useState<Category | null>(null);

  const movable = [...categories].filter((c) => c.id !== 'overview').sort((a, b) => a.order - b.order);

  const move = (id: string, dir: -1 | 1) => {
    const ids = movable.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    haptic('light');
    onReorder(ids);
  };

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div style={{ padding: '4px 12px 16px' }}>
          <div
            style={{
              fontSize: 13, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
              color: 'var(--c-text-secondary)', padding: '4px 4px 10px',
            }}
          >
            Manage categories
          </div>
          {movable.length === 0 && (
            <div style={{ padding: '12px 4px', fontSize: 14, color: 'var(--c-text-tertiary)' }}>
              No custom categories yet.
            </div>
          )}
          {movable.map((cat, idx) => (
            <div
              key={cat.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 4px', borderBottom: '1px solid var(--c-border-light)',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 5, background: cat.color, flexShrink: 0 }} />
              <Icon name={cat.icon} size={16} color="var(--c-text-secondary)" />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.name}
              </span>
              <button onClick={() => move(cat.id, -1)} disabled={idx === 0} aria-label={`Move ${cat.name} up`} style={iconBtn(idx === 0)}>
                <Icon name="chevron-up" size={16} color="var(--c-text-secondary)" />
              </button>
              <button onClick={() => move(cat.id, 1)} disabled={idx === movable.length - 1} aria-label={`Move ${cat.name} down`} style={iconBtn(idx === movable.length - 1)}>
                <Icon name="chevron-down" size={16} color="var(--c-text-secondary)" />
              </button>
              <button onClick={() => setRenaming(cat)} aria-label={`Rename ${cat.name}`} style={iconBtn(false)}>
                <Icon name="create-outline" size={16} color="var(--c-text-secondary)" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${cat.name}"? Its tasks move to Personal.`)) {
                    haptic('medium');
                    onDelete(cat.id);
                  }
                }}
                aria-label={`Delete ${cat.name}`}
                style={iconBtn(false)}
              >
                <Icon name="trash-outline" size={16} color="#e06767" />
              </button>
            </div>
          ))}
        </div>
      </Sheet>

      <PromptModal
        visible={!!renaming}
        title="Rename category"
        defaultValue={renaming?.name ?? ''}
        submitLabel="Rename"
        onCancel={() => setRenaming(null)}
        onSubmit={(name) => {
          const trimmed = name.trim();
          if (trimmed && renaming) onRename(renaming.id, trimmed);
          setRenaming(null);
        }}
      />
    </>
  );
}

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  width: 34, height: 34, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  opacity: disabled ? 0.3 : 1, flexShrink: 0,
});
