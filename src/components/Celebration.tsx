import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface Burst {
  id: number;
  x: number;
  y: number;
  particles: { dx: number; dy: number; color: string; rotate: number }[];
}

interface CelebrationApi {
  /** Fire a short confetti burst at viewport coords. No-op under reduced motion. */
  celebrate: (x: number, y: number) => void;
}

const CelebrationContext = createContext<CelebrationApi | undefined>(undefined);

const COLORS = ['#F59E0B', '#22C55E', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444'];
const COUNT = 14;
const DURATION = 0.6;

function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducemotion === 'on') return true;
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducemotion === 'off') return false;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Phase 4.4 — a shared, lightweight celebration primitive. `celebrate(x, y)`
 * fires a ~600ms confetti burst at a point (e.g. a checked-off task). It is a
 * strict no-op under reduced motion, and particles are pointer-events:none so
 * they never interfere with interaction. Habits reuse this in Phase 5.
 */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  const celebrate = useCallback((x: number, y: number) => {
    if (prefersReducedMotion()) return;
    const id = nextId.current++;
    const particles = Array.from({ length: COUNT }, (_, i) => {
      const angle = (Math.PI * 2 * i) / COUNT + Math.random() * 0.5;
      const dist = 60 + Math.random() * 70;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 20, // bias upward
        color: COLORS[i % COLORS.length],
        rotate: (Math.random() - 0.5) * 360,
      };
    });
    setBursts((prev) => [...prev, { id, x, y, particles }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), DURATION * 1000 + 100);
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3000, overflow: 'hidden' }}>
          <AnimatePresence>
            {bursts.map((burst) =>
              burst.particles.map((p, i) => (
                <motion.span
                  key={`${burst.id}-${i}`}
                  initial={{ x: burst.x, y: burst.y, opacity: 1, scale: 1, rotate: 0 }}
                  animate={{ x: burst.x + p.dx, y: burst.y + p.dy, opacity: 0, scale: 0.4, rotate: p.rotate }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION, ease: [0.2, 0.6, 0.2, 1] }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: p.color,
                  }}
                />
              )),
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </CelebrationContext.Provider>
  );
}

export function useCelebration(): CelebrationApi {
  const ctx = useContext(CelebrationContext);
  // Safe no-op fallback so components can call celebrate without a hard dependency.
  return ctx ?? { celebrate: () => {} };
}
