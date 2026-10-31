import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import tokens from './tokens.json';
import { figtreeFamily, type FigtreeWeight } from './fonts';
import { redesignLight } from './theme';

export type RedesignTypeStyle = keyof typeof tokens.type;

const TONES = ['text', 'textSecondary', 'textOnPrimary', 'primary', 'danger'] as const;

export type RedesignTone = (typeof TONES)[number];

export function redesignTypeStyle(name: RedesignTypeStyle): TextStyle {
  const s = tokens.type[name] as {
    size: number;
    weight: FigtreeWeight;
    line: number;
    tracking: number;
    tabular?: boolean;
  };
  return {
    fontFamily: figtreeFamily(s.weight),
    fontSize: s.size,
    lineHeight: s.line,
    letterSpacing: s.tracking,
    fontVariant: s.tabular ? ['tabular-nums'] : undefined,
    fontFeatureSettings: s.tabular ? '"tnum"' : undefined,
  } as TextStyle;
}

export function RedesignText({
  variant = 'body',
  tone = 'text',
  style,
  ...rest
}: RNTextProps & { variant?: RedesignTypeStyle; tone?: RedesignTone }) {
  return <RNText {...rest} style={[redesignTypeStyle(variant), { color: redesignLight[tone] }, style]} />;
}
