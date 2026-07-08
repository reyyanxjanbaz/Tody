/**
 * AssigneePicker (Phase D) — bottom sheet to assign a shared-workspace task to a
 * member (or clear the assignment). Only meaningful in a shared workspace.
 */
import { Sheet } from '../../ui/Modal';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { haptic } from '../../core/utils/haptics';
import { useCollab } from './CollabContext';
import { MemberAvatar } from './MemberAvatar';

interface Props {
  open: boolean;
  onClose: () => void;
  taskId: string | null;
  currentAssigneeId?: string | null;
}

export function AssigneePicker({ open, onClose, taskId, currentAssigneeId }: Props) {
  const { members, assignTask } = useCollab();

  const pick = (assigneeId: string | null) => {
    if (!taskId) return;
    haptic('selection');
    void assignTask(taskId, assigneeId);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 8px 12px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-secondary)', padding: '8px 12px', letterSpacing: '0.3px' }}>
          Assign to
        </h2>

        <Pressable
          onPress={() => pick(null)}
          hapticStyle={null}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, justifyContent: 'flex-start', background: !currentAssigneeId ? 'var(--c-gray50)' : 'transparent' }}
        >
          <span style={{ width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-gray100)' }}>
            <Icon name="person-outline" size={16} color="var(--c-text-tertiary)" />
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 16, color: 'var(--c-text)' }}>Unassigned</span>
          {!currentAssigneeId && <Icon name="checkmark" size={18} color="var(--c-text)" />}
        </Pressable>

        {members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => pick(m.id)}
            hapticStyle={null}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, justifyContent: 'flex-start', background: currentAssigneeId === m.id ? 'var(--c-gray50)' : 'transparent' }}
          >
            <MemberAvatar member={m} size={30} />
            <span style={{ flex: 1, textAlign: 'left', fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>{m.display_name || 'Member'}</span>
            {currentAssigneeId === m.id && <Icon name="checkmark" size={18} color="var(--c-text)" />}
          </Pressable>
        ))}
      </div>
    </Sheet>
  );
}
