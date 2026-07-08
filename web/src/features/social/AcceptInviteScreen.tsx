/**
 * AcceptInviteScreen (Phase C) — the `/invite/:code` deep-link target.
 *
 * Reachable both authed and unauthed (see AppRouter — the route is registered in
 * both branches):
 *   • Logged out → stash the code as pendingInviteCode and bounce to /register.
 *     After the first login, PendingInviteRedeemer (mounted in the app shell)
 *     redeems it automatically.
 *   • Logged in → redeem immediately and route to the right place by kind
 *     (friend → leaderboard, workspace → home, pact → the pact).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../core/context/AuthContext';
import { Spinner } from '../../ui/Spinner';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';
import { useSocial, setPendingInvite, takePendingInvite } from './SocialContext';

export function AcceptInviteScreen() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { acceptInvite } = useSocial();
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('Joining…');
  const ran = useRef(false);

  useEffect(() => {
    if (isLoading || ran.current || !code) return;
    ran.current = true;

    if (!user) {
      // Capture the invite and send them to sign up; redeemed after login.
      setPendingInvite(code);
      navigate('/register', { replace: true });
      return;
    }

    (async () => {
      const res = await acceptInvite(code);
      if (res.ok) {
        setStatus('ok');
        if (res.kind === 'friend') navigate('/leaderboard', { replace: true });
        else if (res.kind === 'workspace') navigate('/', { replace: true });
        else if (res.kind === 'pact' && res.targetId) navigate(`/pacts/${res.targetId}`, { replace: true });
        else navigate('/', { replace: true });
      } else {
        setStatus('error');
        setMessage(
          res.error === 'offline' ? 'You appear to be offline. Try again in a moment.'
          : 'This invite is invalid, expired, or already used.',
        );
      }
    })();
  }, [code, user, isLoading, acceptInvite, navigate]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: 'var(--c-background)', textAlign: 'center' }}>
      {status === 'working' ? (
        <>
          <Spinner size={26} color="var(--c-text)" />
          <p style={{ fontSize: 15, color: 'var(--c-text-secondary)' }}>{message}</p>
        </>
      ) : status === 'error' ? (
        <>
          <Icon name="alert-circle-outline" size={44} color="var(--c-text-tertiary)" />
          <p style={{ fontSize: 15, color: 'var(--c-text-secondary)', maxWidth: 280 }}>{message}</p>
          <Button title="Go to Tody" onPress={() => navigate('/', { replace: true })} variant="secondary" />
        </>
      ) : null}
    </div>
  );
}

/**
 * PendingInviteRedeemer — mounted once inside the authed shell. When a user logs
 * in with a stored pendingInviteCode (captured while logged out), redeem it.
 */
export function PendingInviteRedeemer() {
  const { user } = useAuth();
  const { acceptInvite } = useSocial();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (!user || done.current) return;
    const code = takePendingInvite();
    if (!code) return;
    done.current = true;
    (async () => {
      const res = await acceptInvite(code);
      if (res.ok && res.kind === 'friend') navigate('/leaderboard');
      else if (res.ok && res.kind === 'pact' && res.targetId) navigate(`/pacts/${res.targetId}`);
    })();
  }, [user, acceptInvite, navigate]);

  return null;
}
