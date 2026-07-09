import { Pressable } from './Pressable';
import { Spinner } from './Spinner';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}

/** Web port of components/Button — spring-pressable, 3 variants, loading state. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantStyle: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--c-surface-dark)', color: 'var(--c-white)' }
      : variant === 'secondary'
      ? {
          background: 'var(--c-white)',
          color: 'var(--c-black)',
          border: '1.5px solid var(--c-surface-dark)',
        }
      : { background: 'transparent', color: 'var(--c-text-secondary)' };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={{
        height: 52,
        width: '100%',
        borderRadius: 'var(--r-button)',
        padding: '0 var(--sp-xxl)',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.2px',
        ...variantStyle,
        ...style,
      }}
    >
      {loading ? (
        <Spinner size={20} color={variant === 'primary' ? 'var(--c-white)' : 'var(--c-black)'} />
      ) : (
        <span style={textStyle}>{title}</span>
      )}
    </Pressable>
  );
}
