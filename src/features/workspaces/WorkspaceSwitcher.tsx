/**
 * WorkspaceSwitcher (Phase B) — the top-of-app identity switcher.
 *
 * A compact button (active workspace icon + name + chevron) that opens a bottom
 * sheet listing all workspaces. Switching is instant (local filter). Lives in a
 * screen header so the tab bar stays four-wide and the current context reads as
 * identity, à la Slack/Notion.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { Sheet, Modal } from '../../ui/Modal';
import { PromptModal } from '../../ui/PromptModal';
import { Button } from '../../ui/Button';
import { haptic } from '../../core/utils/haptics';
import { SPRING_SNAPPY } from '../../theme/motion';
import { useTasks } from '../../core/context/TaskContext';
import { useWorkspaces } from './WorkspaceContext';
import { PERSONAL_WORKSPACE_ID } from './types';
import { InviteSheet } from '../social/InviteSheet';

export function WorkspaceSwitcher() {
  const {
    workspaces, activeWorkspace, activeWorkspaceId, setActiveWorkspace,
    addWorkspace, deleteWorkspace,
  } = useWorkspaces();
  const { reassignWorkspaceTasks } = useTasks();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const removeWorkspace = (mode: 'move' | 'delete') => {
    if (!deletingId) return;
    haptic(mode === 'delete' ? 'heavy' : 'medium');
    reassignWorkspaceTasks(deletingId, mode); // local mirror (offline-safe)
    deleteWorkspace(deletingId, mode);         // server + workspace list
    setDeletingId(null);
  };
  const deletingName = workspaces.find((w) => w.id === deletingId)?.name ?? 'this workspace';

  const pick = (id: string) => {
    if (id !== activeWorkspaceId) { haptic('selection'); setActiveWorkspace(id); }
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => { haptic('light'); setOpen(true); }}
        hapticStyle={null}
        aria-label={`Workspace: ${activeWorkspace.name}. Switch workspace`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 32,
          padding: '0 10px',
          borderRadius: 16,
          background: 'var(--c-gray50)',
          border: '1px solid var(--c-border-light)',
        }}
      >
        <Icon name={activeWorkspace.icon} size={15} color="var(--c-text-secondary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeWorkspace.name}
        </span>
        <Icon name="chevron-down" size={13} color="var(--c-gray400)" />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ padding: '4px 8px 8px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-secondary)', padding: '8px 12px', letterSpacing: '0.3px' }}>
            Workspaces
          </h2>
          {workspaces.map((ws) => {
            const active = ws.id === activeWorkspaceId;
            return (
              <div key={ws.id} style={{ position: 'relative' }}>
                <Pressable
                  onPress={() => pick(ws.id)}
                  hapticStyle={null}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 12px',
                    borderRadius: 12,
                    background: active ? 'var(--c-gray50)' : 'transparent',
                    justifyContent: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: ws.accent ? `${ws.accent}1F` : 'var(--c-gray100)',
                    }}
                  >
                    <Icon name={ws.icon} size={18} color={ws.accent || 'var(--c-text)'} />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>
                    {ws.name}
                  </span>
                  {active && (
                    <motion.span layoutId="ws-check" transition={SPRING_SNAPPY} style={{ display: 'flex' }}>
                      <Icon name="checkmark-circle" size={20} color="var(--c-text)" />
                    </motion.span>
                  )}
                </Pressable>
                {/* Share + delete affordances for named workspaces */}
                {ws.id !== PERSONAL_WORKSPACE_ID && (
                  <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
                    <Pressable
                      onPress={() => { haptic('light'); setOpen(false); setShareId(ws.id); }}
                      aria-label={`Share ${ws.name}`}
                      style={{ padding: 8, background: 'transparent' }}
                    >
                      <Icon name="people-outline" size={16} color="var(--c-gray400)" />
                    </Pressable>
                    {!active && (
                      <Pressable
                        onPress={() => { haptic('warning'); setDeletingId(ws.id); }}
                        aria-label={`Delete ${ws.name}`}
                        style={{ padding: 8, background: 'transparent' }}
                      >
                        <Icon name="trash-outline" size={16} color="var(--c-gray400)" />
                      </Pressable>
                    )}
                  </span>
                )}
              </div>
            );
          })}

          <Pressable
            onPress={() => { setOpen(false); setAdding(true); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 12px',
              marginTop: 4,
              borderRadius: 12,
              justifyContent: 'flex-start',
            }}
          >
            <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--c-border)' }}>
              <Icon name="add" size={18} color="var(--c-text-secondary)" />
            </span>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 16, fontWeight: 600, color: 'var(--c-text-secondary)' }}>
              New workspace
            </span>
          </Pressable>
        </div>
      </Sheet>

      <PromptModal
        visible={adding}
        title="New workspace"
        message="Group tasks, habits and captures under a focused context."
        submitLabel="Create"
        onCancel={() => setAdding(false)}
        onSubmit={(name) => {
          const trimmed = name.trim();
          if (trimmed) {
            const ws = addWorkspace({ name: trimmed });
            setActiveWorkspace(ws.id);
          }
          setAdding(false);
        }}
      />

      <InviteSheet
        open={shareId != null}
        onClose={() => setShareId(null)}
        kind="workspace"
        targetId={shareId ?? undefined}
        title="Share workspace"
        subtitle="They join this workspace and can see and complete its tasks."
      />

      {/* Delete confirm — choose what happens to the workspace's tasks (H3). */}
      <Modal open={deletingId != null} onClose={() => setDeletingId(null)}>
        <div style={{ padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Delete “{deletingName}”?</h2>
          <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Choose what to do with its tasks, habits and captures.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button title="Move everything to Personal" onPress={() => removeWorkspace('move')} variant="primary" />
            <Button title="Delete everything in it" onPress={() => removeWorkspace('delete')} variant="secondary" />
            <Button title="Cancel" onPress={() => setDeletingId(null)} variant="ghost" />
          </div>
        </div>
      </Modal>
    </>
  );
}
