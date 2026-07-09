/** Web replacement for RN's ActivityIndicator — a lightweight CSS ring spinner. */
export function Spinner({
  size = 20,
  color = 'currentColor',
  style,
}: {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  const border = Math.max(2, Math.round(size / 10));
  return (
    <span
      className="tody-spin"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${border}px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        ...style,
      }}
    />
  );
}
