import tokens from './tokens.json';

const light = tokens.color.light;

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

export const redesignLight: RedesignTheme = { ...light };

export { tokens as redesignTokens };
