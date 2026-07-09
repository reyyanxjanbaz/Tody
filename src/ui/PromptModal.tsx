import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  keyboardType?: 'default' | 'number-pad';
  onSubmit: (value: string) => void;
  onCancel: () => void;
  submitLabel?: string;
}

/** Web port of ui/PromptModal — single-field prompt in a centered card. */
export function PromptModal({
  visible,
  title,
  message,
  defaultValue = '',
  keyboardType = 'default',
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible, defaultValue]);

  const submit = () => {
    onSubmit(value);
    setValue('');
  };

  return (
    <Modal open={visible} onClose={onCancel}>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: message ? 4 : 8 }}>{title}</div>
        {message && (
          <div style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
            {message}
          </div>
        )}
        <input
          ref={inputRef}
          value={value}
          inputMode={keyboardType === 'number-pad' ? 'numeric' : 'text'}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
          style={{
            width: '100%',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-input)',
            background: 'var(--c-background)',
            fontSize: 15,
            padding: '10px 12px',
            margin: '8px 0 18px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <button onClick={onCancel} style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text-secondary)' }}>
            Cancel
          </button>
          <button onClick={submit} style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-active)' }}>
            {submitLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
