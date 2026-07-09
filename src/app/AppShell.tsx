import type { ReactNode } from 'react';

/**
 * Mobile-first frame. On phones it fills the viewport; on wider screens it
 * constrains to a phone-width column, centered, with a subtle divider — so the
 * PWA reads as an app, not a stretched web page. Pages animate within `.stage`;
 * an optional `bottomBar` (the tab bar) sits below the stage, so the stage
 * shrinks to leave room and pages never render under the tabs.
 */
export function AppShell({ children, bottomBar }: { children: ReactNode; bottomBar?: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--c-background)',
      }}
    >
      <div
        className="tody-frame"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'var(--c-background)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Stage: absolutely-positioned pages cross-fade/slide here */}
        <div className="stage" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {bottomBar}
      </div>
    </div>
  );
}
