import { motion } from 'framer-motion';

/** Web port of components/SectionHeader — big serif title + muted count. */
export function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: 'var(--sp-xxl) var(--sp-xxl) var(--sp-md)',
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--c-text)' }}>
        {title}
      </span>
      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--c-gray500)' }}>{count}</span>
    </motion.div>
  );
}
