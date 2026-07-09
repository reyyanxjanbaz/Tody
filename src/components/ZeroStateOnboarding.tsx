import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { STARTER_TEMPLATES, type StarterTemplate } from '../core/utils/starterTemplates';

interface Props {
  onSelectTemplate: (template: StarterTemplate) => void;
  onScratch: () => void;
}

/**
 * Web port of native ZeroStateOnboarding. Shown on a brand-new empty Home
 * (overview, never added a task): a warm welcome plus three one-tap starter
 * bundles, or "create from scratch" — lowering the blank-page barrier that's
 * especially costly for ND users.
 */
export function ZeroStateOnboarding({ onSelectTemplate, onScratch }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      style={{ padding: '32px 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 6 }}>Welcome to ToDy</h2>
      <p style={{ fontSize: 15, color: 'var(--c-text-secondary)', textAlign: 'center', marginBottom: 24 }}>
        Pick a starter set to get moving
      </p>

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STARTER_TEMPLATES.map((tpl, i) => (
          <motion.button
            key={tpl.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i + 0.1, duration: 0.3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { haptic('medium'); onSelectTemplate(tpl); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: 16, borderRadius: 'var(--r-card)',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              textAlign: 'left', width: '100%',
            }}
          >
            <span
              style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${tpl.iconColor}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={tpl.icon} size={22} color={tpl.iconColor} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{tpl.title}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--c-text-secondary)', marginTop: 2 }}>{tpl.description}</span>
            </span>
            <Icon name="chevron-forward" size={16} color="var(--c-gray400)" />
          </motion.button>
        ))}
      </div>

      <button
        onClick={() => { haptic('light'); onScratch(); }}
        style={{ marginTop: 20, fontSize: 15, fontWeight: 600, color: 'var(--c-text-secondary)', padding: '10px 16px' }}
      >
        Create from scratch
      </button>
    </motion.div>
  );
}
