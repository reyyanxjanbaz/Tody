/**
 * SocialHubScreen — the one place all social/collaboration surfaces live.
 *
 * Gathers friends (list + remove + invite), the weekly leaderboard glance,
 * your pacts (with an explainer empty state + create), and your shared
 * workspaces (invite collaborators). Reached from the Profile "Friends & Pacts"
 * card. Everything here is online-authoritative (backend), degrading to cached
 * snapshots when offline.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { haptic } from '../../core/utils/haptics';
import { useSocial } from './SocialContext';
import { InviteSheet } from './InviteSheet';
import { usePacts } from '../pacts/PactContext';
import { PactCard } from '../pacts/PactCard';
import { CreatePactSheet } from '../pacts/CreatePactSheet';
import { useWorkspaces } from '../workspaces/WorkspaceContext';
import type { Friend } from './types';

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.4px',
  color: 'var(--c-text-tertiary)',
  textTransform: 'uppercase',
  padding: '0 4px',
};

function Avatar({ url, name, size = 36 }: { url: string | null; name: string | null; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, overflow: 'hidden', background: 'var(--c-gray100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: size * 0.42, fontWeight: 700, color: 'var(--c-text-secondary)' }}>
          {(name || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function SocialHubScreen() {
  const navigate = useNavigate();
  const { friends, leaderboard, myRank, removeFriend } = useSocial();
  const { activePacts } = usePacts();
  const { namedWorkspaces } = useWorkspaces();

  const [inviteFriendOpen, setInviteFriendOpen] = useState(false);
  const [creatingPact, setCreatingPact] = useState(false);
  const [shareWsId, setShareWsId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Friend | null>(null);

  const hasFriends = friends.length > 0;
  const topRows = leaderboard.slice(0, 3);

  const confirmRemove = () => {
    if (!removing) return;
    haptic('warning');
    void removeFriend(removing.id);
    setRemoving(null);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', paddingTop: 'var(--safe-top)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 6px' }}>
        <Pressable onPress={() => navigate(-1)} aria-label="Back" style={{ padding: 4 }}>
          <Icon name="chevron-back" size={26} />
        </Pressable>
        <h1 style={{ flex: 1, fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>Friends &amp; Pacts</h1>
      </header>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, padding: '8px 16px', paddingBottom: 'calc(var(--safe-bottom) + 40px)', display: 'flex', flexDirection: 'column', gap: 26 }}>
        {/* ── Friends ─────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ ...sectionTitle, flex: 1 }}>Friends</span>
            <Pressable onPress={() => setInviteFriendOpen(true)} aria-label="Invite friends" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-pill)', background: 'var(--c-surface-dark)' }}>
              <Icon name="people-outline" size={15} color="var(--c-white)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-white)' }}>Invite</span>
            </Pressable>
          </div>

          {!hasFriends ? (
            <div style={{ padding: '20px 16px', borderRadius: 'var(--r-card)', background: 'var(--c-surface)', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No friends yet</div>
              <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)', marginTop: 3 }}>
                Invite someone who uses Tody and race on weekly XP and streaks.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {friends.map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
                  <Avatar url={f.avatar_url} name={f.display_name} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.display_name || 'Friend'}
                  </span>
                  <Pressable onPress={() => setRemoving(f)} aria-label={`Remove ${f.display_name || 'friend'}`} style={{ padding: 8, background: 'transparent' }}>
                    <Icon name="remove-circle-outline" size={18} color="var(--c-gray400)" />
                  </Pressable>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Weekly leaderboard glance ───────────────────────────── */}
        {hasFriends && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={sectionTitle}>This week</span>
            <Pressable onPress={() => navigate('/leaderboard')} hapticStyle="light" style={{ display: 'block', width: '100%', textAlign: 'left', padding: 16, borderRadius: 'var(--r-card)', background: 'var(--c-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Leaderboard</span>
                {myRank != null && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-secondary)' }}>You're #{myRank}</span>}
                <Icon name="chevron-forward" size={18} color="var(--c-text-tertiary)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topRows.map((r) => (
                  <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 16, fontSize: 13, fontWeight: 800, color: 'var(--c-text-tertiary)' }}>{r.rank}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: r.is_self ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.is_self ? 'You' : r.display_name}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{r.weekly_xp} XP</span>
                  </div>
                ))}
              </div>
            </Pressable>
          </section>
        )}

        {/* ── Pacts ───────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ ...sectionTitle, flex: 1 }}>Pacts</span>
            <Pressable onPress={() => setCreatingPact(true)} aria-label="New pact" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-pill)', background: 'var(--c-surface-dark)' }}>
              <Icon name="add" size={16} color="var(--c-white)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-white)' }}>New</span>
            </Pressable>
          </div>

          {activePacts.length === 0 ? (
            <div style={{ padding: '20px 16px', borderRadius: 'var(--r-card)', background: 'var(--c-surface)', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-gray100)' }}>
                <Icon name="flag-outline" size={22} color="var(--c-text)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Make a pact</div>
              <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)', marginTop: 3, lineHeight: 1.45 }}>
                A group task that only completes when <em>everyone</em> finishes their part. Great for shared goals and accountability.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activePacts.map((p) => <PactCard key={p.id} pact={p} />)}
            </div>
          )}
        </section>

        {/* ── Shared workspaces ───────────────────────────────────── */}
        {namedWorkspaces.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={sectionTitle}>Share a workspace</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {namedWorkspaces.map((ws) => (
                <div key={ws.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ws.accent ? `${ws.accent}1F` : 'var(--c-gray100)' }}>
                    <Icon name={ws.icon} size={18} color={ws.accent || 'var(--c-text)'} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.name}
                  </span>
                  <Pressable onPress={() => setShareWsId(ws.id)} aria-label={`Share ${ws.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-pill)', background: 'var(--c-gray100)' }}>
                    <Icon name="people-outline" size={15} color="var(--c-text-secondary)" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)' }}>Share</span>
                  </Pressable>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <InviteSheet open={inviteFriendOpen} onClose={() => setInviteFriendOpen(false)} kind="friend" />
      <CreatePactSheet open={creatingPact} onClose={() => setCreatingPact(false)} />
      <InviteSheet
        open={shareWsId != null}
        onClose={() => setShareWsId(null)}
        kind="workspace"
        targetId={shareWsId ?? undefined}
        title="Share workspace"
        subtitle="They join this workspace and can see and complete its tasks."
      />

      <Modal open={removing != null} onClose={() => setRemoving(null)}>
        <div style={{ padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Remove {removing?.display_name || 'this friend'}?</h2>
          <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            You'll drop off each other's leaderboard. You can always re-invite them later.
          </p>
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button title="Remove friend" onPress={confirmRemove} variant="secondary" />
            <Button title="Cancel" onPress={() => setRemoving(null)} variant="ghost" />
          </motion.div>
        </div>
      </Modal>
    </div>
  );
}
