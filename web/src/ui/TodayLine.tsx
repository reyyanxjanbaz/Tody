/** Web port of components/TodayLine — thin horizon separating Now from Later. */
export function TodayLine() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 16px',
        background: 'var(--c-background)',
      }}
    >
      <div style={{ height: 1, width: 12, background: 'var(--c-text)' }} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', gap: 3 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#EF4444',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.5px',
            color: 'var(--c-text-secondary)',
          }}
        >
          TODAY
        </span>
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--c-text)' }} />
    </div>
  );
}
