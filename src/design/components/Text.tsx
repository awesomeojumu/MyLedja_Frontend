import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import type { Theme } from '../theme';

export type TypeStyle = keyof typeof tokens.type;
type Tone = 'text' | 'textSecondary' | 'textHelper' | 'link' | 'goldLabel' | 'onPrimaryFill' | 'onSidebar';

export const fontFamilies = { '300': 'Inter_300Light', '400': 'Inter_400Regular' } as const;

export function typeStyle(name: TypeStyle): TextStyle {
  const s = tokens.type[name] as {
    size: number;
    weight: '300' | '400';
    line: number;
    tracking: number;
    tabular?: boolean;
    uppercase?: boolean;
  };
  return {
    fontFamily: fontFamilies[s.weight],
    fontSize: s.size,
    lineHeight: Math.round(s.size * s.line),
    letterSpacing: s.tracking,
    fontVariant: s.tabular ? ['tabular-nums'] : undefined,
    textTransform: s.uppercase ? 'uppercase' : undefined,
    fontFeatureSettings: s.tabular ? '"ss01", "tnum"' : '"ss01"',
  } as TextStyle;
}

export type TextProps = RNTextProps & { variant?: TypeStyle; tone?: Tone };

export function Text({ variant = 'body-md', tone = 'text', style, ...rest }: TextProps) {
  const theme: Theme = useTheme();
  return <RNText {...rest} style={[typeStyle(variant), { color: theme[tone] }, style]} />;
}
