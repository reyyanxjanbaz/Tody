/**
 * InviteSheet (Phase C) — create and share an invite link.
 *
 * Reused by Phases D/E via the `kind`/`targetId` props (friend / workspace / pact).
 * Uses the Web Share API when available, falling back to clipboard copy.
 */
import { useState, useEffect, useCallback } from 'react';
import { Sheet } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Spinner } from '../../ui/Spinner';
import { haptic } from '../../core/utils/haptics';
import { useSocial } from './SocialContext';
import type { InviteKind } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  kind?: InviteKind;
  targetId?: string;
  title?: string;
  subtitle?: string;
}

export function InviteSheet({ open, onClose, kind = 'friend', targetId, title, subtitle }: Props) {
  const { createInvite } = useSocial();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mint a fresh code each time the sheet opens.
  useEffect(() => {
    if (!open) { setUrl(null); setCopied(false); return; }
    let cancelled = false;
    setLoading(true);
    createInvite(kind, targetId).then((res) => {
      if (!cancelled) { setUrl(res?.url ?? null); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [open, kind, targetId, createInvite]);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = useCallback(async () => {
    if (!url) return;
    haptic('light');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }, [url]);

  const share = useCallback(async () => {
    if (!url) return;
    haptic('light');
    const shareData = { title: 'Join me on Tody', text: title ?? 'Come compete with me on Tody', url };
    if (canShare) {
      try { await navigator.share(shareData); return; } catch { /* fall through to copy */ }
    }
    await copy();
  }, [url, title, canShare, copy]);

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-gray100)' }}>
            <Icon name="people-outline" size={26} color="var(--c-text)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{title ?? 'Invite a friend'}</h2>
          <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginTop: 4 }}>
            {subtitle ?? 'They join, you compete on weekly scores and streaks.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 12, background: 'var(--c-gray50)', border: '1px solid var(--c-border-light)', minHeight: 48 }}>
          {loading ? (
            <Spinner size={16} color="var(--c-text-secondary)" />
          ) : (
            <>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {url ?? 'Could not create an invite. Check your connection.'}
              </span>
              {url && (
                <button
                  onClick={copy}
                  aria-label={copied ? 'Copied' : 'Copy link'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    height: 36, padding: '0 12px', borderRadius: 9,
                    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                    fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
                  }}
                >
                  <Icon name={copied ? 'checkmark' : 'copy-outline'} size={15} color="var(--c-text)" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </>
          )}
        </div>

        <Button
          onPress={share}
          disabled={!url}
          variant="primary"
          title={canShare ? 'Share invite' : 'Copy link'}
        />
      </div>
    </Sheet>
  );
}
