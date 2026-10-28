import type { LucideIcon, LucideProps } from 'lucide-react-native';

import { useTheme } from '../ThemeProvider';

/** DESIGN 2.5: Lucide at 18 (nav), 16 (rows), 20 (tiles). Default ink-secondary. */
export type IconSize = 'nav' | 'row' | 'tile' | number;

const SIZE_PX: Record<'nav' | 'row' | 'tile', number> = {
  nav: 18,
  row: 16,
  tile: 20,
};

type Props = Omit<LucideProps, 'size' | 'color'> & {
  icon: LucideIcon;
  size?: IconSize;
  color?: string;
  /** When set, fills the glyph (e.g. status dots). */
  fill?: string;
};

export function Icon({ icon: Glyph, size = 'row', color, fill, ...rest }: Props) {
  const theme = useTheme();
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  return <Glyph size={px} color={color ?? theme.textSecondary} fill={fill} {...rest} />;
}
