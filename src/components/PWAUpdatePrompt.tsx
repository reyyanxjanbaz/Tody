import { useRegisterSW } from 'virtual:pwa-register/react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Service-worker lifecycle UI:
 *  • "Ready to work offline" — first successful precache.
 *  • "New version available — Reload" — a new SW is waiting (registerType: 'prompt').
 * A calm bottom banner matching the app's monochrome language.
 */
export function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const show = offlineReady || needRefresh;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(var(--safe-bottom) + 16px)',
            display: 'flex',
            justifyContent: 'center',
            padding: '0 16px',
            zIndex: 1300,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: 'min(100%, 440px)',
              background: '#000',
              color: '#fff',
              borderRadius: 10,
              padding: '12px 16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
              {needRefresh ? 'A new version is available.' : 'Ready to work offline.'}
            </span>
            {needRefresh && (
              <button
                onClick={() => updateServiceWorker(true)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600 }}
              >
                Reload
              </button>
            )}
            <button onClick={close} style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
