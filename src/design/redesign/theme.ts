import tokens from './tokens.json';

const light = tokens.color.light;
const dark = tokens.color.dark;

export type RedesignTheme = {
  page: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textOnPrimary: string;
  primary: string;
  primarySoft: string;
  progressTrack: string;
  progressFill: string;
  danger: string;
  offline: string;
  focus: string;
  handle: string;
  navInactive: string;
  navActive: string;
  navActivePill: string;
};

const lightSnapshot: RedesignTheme = { ...light };
const darkSnapshot: RedesignTheme = { ...dark };

const LIVE_KEY = '__myledjaRedesignTheme';

function liveTheme(): RedesignTheme {
  const host = globalThis as Record<string, RedesignTheme | undefined>;
  if (!host[LIVE_KEY]) host[LIVE_KEY] = { ...lightSnapshot };
  return host[LIVE_KEY];
}

/**
 * Live palette. Screens import this as `theme` and read it during render.
 * DesignProvider copies light or dark into it before children render.
 * One object on globalThis, so split module copies still share it.
 */
export const redesignLight: RedesignTheme = liveTheme();

export function syncRedesignTheme(mode: 'light' | 'dark'): void {
  Object.assign(liveTheme(), mode === 'dark' ? darkSnapshot : lightSnapshot);
}

export { tokens as redesignTokens };
