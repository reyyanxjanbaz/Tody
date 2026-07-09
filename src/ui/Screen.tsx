import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

interface ScreenProps {
  title?: string;
  onBack?: () => void;
  /** Show a back chevron in the header. Defaults to true when onBack given. */
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  /** Header transparency / omission */
  header?: boolean;
}

/**
 * Standard screen frame: fixed header (with optional back) + a scrollable body
 * that respects the safe-area insets. Pages fill the AppShell stage.
 */
export function Screen({ title, onBack, back, right, header = true, children }: ScreenProps) {
  const navigate = useNavigate();
  const showBack = back ?? !!onBack;
  const goBack = onBack ?? (() => navigate(-1));

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-background)',
        color: 'var(--c-text)',
      }}
    >
      {header && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 'calc(var(--safe-top) + 10px) var(--sp-lg) 10px',
            minHeight: 52,
          }}
        >
          {showBack && (
            <Pressable onPress={goBack} hapticStyle="light" style={{ marginLeft: -6, padding: 6 }} aria-label="Back">
              <Icon name="chevron-back" size={26} color="var(--c-text)" />
            </Pressable>
          )}
          {title && <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', flex: 1 }}>{title}</h1>}
          {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
        </header>
      )}
      <div className="tody-scroll" style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
