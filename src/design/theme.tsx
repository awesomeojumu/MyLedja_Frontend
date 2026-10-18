/* MyLedja theme for React Native: follows the phone's light/dark setting, the person's font choice and reduce-motion. */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { namedFontFamily, WEB_SPACE_CSS } from "@/design/font-stack";
import { breakpoint, colors, ColorTokens, radius, size, space, spring, type, TypeStyle } from "@/design/tokens";

/** Fonts people can pick in Settings → Display. 'system' costs no download. Add more only if they have tabular numerals. */
export type FontChoice = 'inter' | 'system';
export const FONT_FAMILIES: Record<FontChoice, { regular: string | undefined; medium: string | undefined; semibold: string | undefined; bold: string | undefined }> = {
  inter: { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' },
  system: { regular: undefined, medium: undefined, semibold: undefined, bold: undefined },
};

export interface Theme {
  scheme: 'light' | 'dark';
  c: ColorTokens;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  spring: typeof spring;
  font: FontChoice;
  reduceMotion: boolean;
  haptics: boolean;
  /** compact < 600, medium 600–899, expanded 900–1199, large ≥ 1200 */
  widthClass: 'compact' | 'medium' | 'expanded' | 'large';
  /** True when the window is taller than it is wide (laptop flipped, phone). */
  portrait: boolean;
  /** A text style for a type token, in the chosen font. */
  text: (style: TypeStyle) => { fontSize: number; lineHeight: number; fontWeight: any; letterSpacing?: number; fontFamily?: string; fontVariant?: any };
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  /** Force a scheme; by default it follows the phone. */
  scheme?: 'light' | 'dark';
  font?: FontChoice;
  haptics?: boolean;
  children?: React.ReactNode;
}

function weightKey(w: string): 'regular' | 'medium' | 'semibold' | 'bold' {
  const n = Number(w);
  return n >= 650 ? 'bold' : n >= 600 ? 'semibold' : n >= 500 ? 'medium' : 'regular';
}

export function ThemeProvider(p: ThemeProviderProps) {
  const system = useColorScheme();
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'myledja-web-focus';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = WEB_SPACE_CSS;
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const next = p.scheme || (system === "dark" ? "dark" : "light");
    document.documentElement.style.colorScheme = next;
    document.documentElement.style.backgroundColor = colors[next].bg;
    document.body.style.backgroundColor = colors[next].bg;
  }, [p.scheme, system]);
  const scheme = p.scheme || (system === 'dark' ? 'dark' : 'light');
  const font = p.font || 'inter';
  const value = useMemo<Theme>(() => ({
    scheme,
    c: colors[scheme] as ColorTokens,
    space, radius, size, spring, font, reduceMotion,
    haptics: p.haptics !== false,
    widthClass: width >= breakpoint.bpLarge ? 'large' : width >= breakpoint.bpExpanded ? 'expanded' : width >= breakpoint.bpMedium ? 'medium' : 'compact',
    portrait: height > width,
    text: (style: TypeStyle) => {
      const s: any = type[style];
      const fam = namedFontFamily(FONT_FAMILIES[font][weightKey(s.fontWeight)], Platform.OS === "web");
      // Custom font files carry their weight in the family name; the system font needs fontWeight.
      // On web we keep fontWeight so Inter / system-ui still pick the right cut if the named face misses a glyph.
      return { ...s, fontFamily: fam, fontWeight: fam && Platform.OS !== "web" ? undefined : s.fontWeight, fontVariant: s.fontVariant ? [...s.fontVariant] : undefined };
    },
  }), [scheme, font, reduceMotion, p.haptics, width, height]);
  return <ThemeContext.Provider value={value}>{p.children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('MyLedja: wrap the app in <ThemeProvider>.');
  return t;
}

export const isIOS = Platform.OS === 'ios';
