import { forwardRef } from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

/** Standard single-line input with the app's calm outlined style. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, style, ...rest },
  ref,
) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {label && (
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', color: 'var(--c-text-secondary)' }}>
          {label}
        </span>
      )}
      <input
        ref={ref}
        style={{
          width: '100%',
          height: 48,
          padding: '0 14px',
          fontSize: 16,
          borderRadius: 'var(--r-input)',
          border: `1px solid ${error ? '#e06767' : 'var(--c-border)'}`,
          background: 'var(--c-surface)',
          color: 'var(--c-text)',
          ...style,
        }}
        {...rest}
      />
      {error && <span style={{ fontSize: 12, color: '#e06767' }}>{error}</span>}
    </label>
  );
});
