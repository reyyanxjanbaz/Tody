import { ICONS } from './iconRegistry';

interface IconProps {
  /** Ionicons kebab name, e.g. "checkmark-done-outline" */
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Web replacement for react-native-vector-icons/Ionicons.
 * Resolves the kebab name against the tree-shaken react-icons/io5 registry.
 * Unknown names degrade to an empty inline-block box of the right size so
 * layout never jumps (and it's visible during dev that a name is missing).
 */
export function Icon({ name, size = 20, color = 'currentColor', style, className }: IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) {
    if (import.meta.env.DEV) console.warn(`[Icon] missing "${name}" — add it to iconRegistry`);
    return <span style={{ display: 'inline-block', width: size, height: size, ...style }} />;
  }
  return <Cmp size={size} color={color} style={style} className={className} aria-hidden />;
}
