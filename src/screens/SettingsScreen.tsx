import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Screen } from '../ui/Screen';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { Modal } from '../ui/Modal';
import { useAuth } from '../core/context/AuthContext';
import { useTheme } from '../core/context/ThemeContext';
import { usePreferences } from '../app/PreferencesContext';
import { supabase } from '../core/lib/supabase';
import { api } from '../core/lib/api';
import { type UserPreferences } from '../core/types';
import { haptic } from '../core/utils/haptics';
import { Alert } from '../lib/alert';
import { notificationsSupported, permissionState, requestNotificationPermission } from '../core/lib/notifications';
import { subscribeToPush, pushSupported } from '../core/lib/push';

type NotifPrefs = { assignment: boolean; pact: boolean; friend: boolean };
const DEFAULT_NOTIF_PREFS: NotifPrefs = { assignment: true, pact: true, friend: true };
const PUSH_CATEGORIES: { key: keyof NotifPrefs; label: string; icon: string }[] = [
  { key: 'assignment', label: 'Task assignments', icon: 'person-outline' },
  { key: 'pact', label: 'Pact activity', icon: 'flag-outline' },
  { key: 'friend', label: 'New friends', icon: 'people-outline' },
];

const DATE_FORMATS: UserPreferences['dateFormat'][] = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
const TIME_FORMATS: UserPreferences['timeFormat'][] = ['12h', '24h'];
const WEEK_STARTS: UserPreferences['weekStartsOn'][] = ['sunday', 'monday'];

const TEXT_SIZES = ['sm', 'md', 'lg'] as const;
const TEXT_SIZE_LABELS: Record<(typeof TEXT_SIZES)[number], string> = { sm: 'Small', md: 'Default', lg: 'Large' };
const REDUCE_MOTION = ['system', 'on', 'off'] as const;
const REDUCE_MOTION_LABELS: Record<(typeof REDUCE_MOTION)[number], string> = { system: 'System', on: 'On', off: 'Off' };

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={on}
      aria-label={label}
      style={{
        width: 46,
        height: 28,
        borderRadius: 14,
        background: on ? 'var(--c-gray800)' : 'var(--c-gray200)',
        padding: 3,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <motion.span layout transition={{ type: 'spring', damping: 22, stiffness: 320 }} style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', display: 'block' }} />
    </button>
  );
}

export function SettingsScreen() {
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { prefs, setPref, webPrefs, setWebPref } = usePreferences();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(permissionState());
  const [shareStats, setShareStats] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);

  // Load stat-sharing + push-category preferences from the profile.
  useEffect(() => {
    let cancelled = false;
    api.get<{ share_stats?: boolean; notif_prefs?: Partial<NotifPrefs> }>('/profile').then(({ data }) => {
      if (cancelled || !data) return;
      if (typeof data.share_stats === 'boolean') setShareStats(data.share_stats);
      if (data.notif_prefs) setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...data.notif_prefs });
    });
    return () => { cancelled = true; };
  }, []);

  const toggleNotifPref = (key: keyof NotifPrefs) => {
    haptic('light');
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next); // optimistic
    api.patch('/profile', { notif_prefs: next }).then(({ isBackendDown, error }) => {
      if (isBackendDown || error) setNotifPrefs(notifPrefs); // revert on failure
    });
  };

  const toggleShareStats = () => {
    haptic('light');
    const next = !shareStats;
    setShareStats(next); // optimistic
    api.patch('/profile', { share_stats: next }).then(({ isBackendDown, error }) => {
      if (isBackendDown || error) setShareStats(!next); // revert on failure
    });
  };

  const enableReminders = async () => {
    haptic('medium');
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    // Register this device for server-initiated push (assignment/pact/friend).
    if (p === 'granted' && pushSupported()) void subscribeToPush();
  };

  const update = <K extends keyof UserPreferences>(k: K, v: UserPreferences[K]) => {
    haptic('light');
    setPref(k, v);
  };
  const cycle = <T,>(arr: T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];

  const changePassword = async () => {
    if (!newPw.trim()) return setPwMsg('New password is required');
    if (newPw.length < 6) return setPwMsg('New password must be at least 6 characters');
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return setPwMsg(error.message);
    haptic('success');
    setPwMsg('Password updated');
    setCurrentPw('');
    setNewPw('');
    setTimeout(() => setPwMsg(''), 3000);
  };

  const confirmDelete = async () => {
    haptic('heavy');
    setShowDelete(false);
    const { error, isBackendDown } = await api.delete('/profile');
    if (isBackendDown) return Alert.alert('Could not reach server', 'Your account was NOT deleted.');
    if (error) return Alert.alert('Deletion failed', error.message);
    await logout();
  };

  const card: React.CSSProperties = { background: 'var(--c-surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--c-border-light)' };
  const prefRow: React.CSSProperties = { ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginBottom: 8, width: '100%' };
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-tertiary)', margin: '0 0 12px' };
  const input: React.CSSProperties = { height: 48, width: '100%', borderRadius: 'var(--r-input)', padding: '0 16px', background: 'var(--c-gray100)', color: 'var(--c-text)', fontSize: 16, marginBottom: 8 };

  return (
    <Screen title="Settings" onBack={() => history.back()}>
      <div style={{ padding: '8px 24px 40px' }}>
        {/* Account */}
        <div style={sectionTitle}>ACCOUNT</div>
        <div style={{ ...card, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Change Password</div>
          <input style={input} type="password" placeholder="Current password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          <input style={input} type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          {pwMsg && <div style={{ fontSize: 12, color: 'var(--c-text-secondary)', marginBottom: 8 }}>{pwMsg}</div>}
          <Pressable onPress={changePassword} style={{ width: '100%', padding: '12px 0', background: 'var(--c-surface-dark)', color: 'var(--c-white)', borderRadius: 'var(--r-button)', fontSize: 14, fontWeight: 600 }}>
            Update Password
          </Pressable>
        </div>

        <Pressable onPress={async () => { haptic('medium'); await logout(); }} style={{ ...prefRow, gap: 12, justifyContent: 'flex-start' }}>
          <Icon name="log-out-outline" size={20} /> <span style={{ fontSize: 15, fontWeight: 500 }}>Log Out</span>
        </Pressable>
        <Pressable onPress={() => setShowDelete(true)} style={{ ...prefRow, gap: 12, justifyContent: 'flex-start', border: '1px solid var(--c-gray200)' }}>
          <Icon name="trash-outline" size={20} color="var(--c-gray800)" /> <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-gray800)' }}>Delete Account</span>
        </Pressable>

        {/* Preferences */}
        <div style={{ ...sectionTitle, marginTop: 32 }}>PREFERENCES</div>
        <div style={prefRow}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="moon-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Dark Mode</span>
          </span>
          <Toggle on={isDark} onChange={() => { toggleTheme(); }} label="Dark mode" />
        </div>
        <button style={prefRow} onClick={() => update('dateFormat', cycle(DATE_FORMATS, prefs.dateFormat))}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="calendar-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Date Format</span></span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{prefs.dateFormat}</span>
        </button>
        <button style={prefRow} onClick={() => update('timeFormat', cycle(TIME_FORMATS, prefs.timeFormat))}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="time-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Time Format</span></span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{prefs.timeFormat}</span>
        </button>
        <button style={prefRow} onClick={() => update('weekStartsOn', cycle(WEEK_STARTS, prefs.weekStartsOn))}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="grid-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Week Starts On</span></span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{prefs.weekStartsOn === 'sunday' ? 'Sunday' : 'Monday'}</span>
        </button>
        <div style={{ ...sectionTitle, marginTop: 32 }}>ACCESSIBILITY</div>
        <button style={prefRow} onClick={() => { haptic('selection'); setWebPref('textSize', cycle([...TEXT_SIZES], webPrefs.textSize)); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="text-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Text Size</span></span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{TEXT_SIZE_LABELS[webPrefs.textSize]}</span>
        </button>
        <button style={prefRow} onClick={() => { haptic('selection'); setWebPref('reduceMotion', cycle([...REDUCE_MOTION], webPrefs.reduceMotion)); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="pulse-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Reduce Motion</span></span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-secondary)' }}>{REDUCE_MOTION_LABELS[webPrefs.reduceMotion]}</span>
        </button>

        {notificationsSupported() && (
          <>
            <div style={{ ...sectionTitle, marginTop: 32 }}>REMINDERS</div>
            {notifPerm === 'granted' ? (
              <div style={prefRow}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="notifications-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Reminders</span></span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#22C55E' }}>On</span>
              </div>
            ) : (
              <Pressable onPress={enableReminders} style={{ ...prefRow, gap: 12, justifyContent: 'flex-start' }}>
                <Icon name="notifications-outline" size={20} color="var(--c-text-secondary)" />
                <span style={{ fontSize: 15, fontWeight: 500 }}>{notifPerm === 'denied' ? 'Reminders blocked — allow in your browser' : 'Enable reminders'}</span>
              </Pressable>
            )}
            {/* Per-category push toggles — only meaningful once permission is granted. */}
            {notifPerm === 'granted' && pushSupported() && PUSH_CATEGORIES.map((c) => (
              <div key={c.key} style={prefRow}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon name={c.icon} size={18} color="var(--c-text-secondary)" />
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{c.label}</span>
                </span>
                <Toggle on={notifPrefs[c.key]} onChange={() => toggleNotifPref(c.key)} label={c.label} />
              </div>
            ))}
            <div style={{ ...prefRow, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="moon-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Quiet hours</span></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--c-text-secondary)' }}>
                <input type="time" aria-label="Quiet hours start" value={webPrefs.quietHoursStart ?? ''} onChange={(e) => setWebPref('quietHoursStart', e.target.value || null)} style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--c-gray200)', background: 'var(--c-gray50)', color: 'var(--c-text)', colorScheme: isDark ? 'dark' : 'light', padding: '0 8px' }} />
                <span>to</span>
                <input type="time" aria-label="Quiet hours end" value={webPrefs.quietHoursEnd ?? ''} onChange={(e) => setWebPref('quietHoursEnd', e.target.value || null)} style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--c-gray200)', background: 'var(--c-gray50)', color: 'var(--c-text)', colorScheme: isDark ? 'dark' : 'light', padding: '0 8px' }} />
              </div>
            </div>
          </>
        )}

        {/* Privacy — Phase C */}
        <div style={{ ...sectionTitle, marginTop: 32 }}>PRIVACY</div>
        <div style={{ ...prefRow, alignItems: 'flex-start' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, marginRight: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="trophy-outline" size={18} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Share my stats with friends</span></span>
            <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginLeft: 30 }}>Lets friends see your weekly score on the leaderboard.</span>
          </span>
          <Toggle on={shareStats} onChange={toggleShareStats} label="Share stats with friends" />
        </div>

        <Pressable onPress={() => { if (window.confirm('Restore all settings to defaults?')) { haptic('medium'); setPref('dateFormat', 'MM/DD/YYYY'); setPref('timeFormat', '12h'); setPref('weekStartsOn', 'sunday'); setWebPref('textSize', 'md'); setWebPref('reduceMotion', 'system'); } }} style={{ ...prefRow, gap: 12, justifyContent: 'flex-start', marginTop: 16 }}>
          <Icon name="refresh-outline" size={20} color="var(--c-text-secondary)" /> <span style={{ fontSize: 15, fontWeight: 500 }}>Reset Preferences</span>
        </Pressable>
      </div>

      <Modal open={showDelete} onClose={() => setShowDelete(false)}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>Delete Account?</div>
          <div style={{ fontSize: 14, color: 'var(--c-text-tertiary)', marginTop: 8 }}>This action cannot be undone. All your data will be permanently removed.</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <button onClick={() => setShowDelete(false)} style={{ padding: '8px 20px', color: 'var(--c-text-tertiary)' }}>Cancel</button>
            <button onClick={confirmDelete} style={{ padding: '12px 24px', background: 'var(--c-surface-dark)', color: 'var(--c-white)', borderRadius: 'var(--r-button)' }}>Delete</button>
          </div>
        </div>
      </Modal>
    </Screen>
  );
}
