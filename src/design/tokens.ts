/**
 * MyLedja Design Tokens
 * Simple, elegant White & Blue aesthetic with clean Light & Dark theme support.
 */

export const typography = {
  fonts: {
    light: 'Inter_300Light',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
  },
  sizes: {
    xs: 11,
    sm: 13,
    bodySm: 14,
    body: 15,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    heroSm: 28,
    hero: 34,
    display: 40,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  colossal: 48,
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export interface ColorTheme {
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceElevated: string;

  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryBorder: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textLink: string;

  border: string;
  borderSubtle: string;
  borderFocus: string;

  statusSuccess: string;
  statusSuccessLight: string;
  statusWarning: string;
  statusWarningLight: string;
  statusDanger: string;
  statusDangerLight: string;
  statusNeutral: string;
  statusNeutralLight: string;

  overlay: string;
}

export const lightColors: ColorTheme = {
  // Backgrounds & Surfaces
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceSubtle: '#F1F5F9',
  surfaceElevated: '#FFFFFF',

  // Primary Blue Accents
  primary: '#2563EB',         // Vibrant Cobalt Blue
  primaryHover: '#1D4ED8',
  primaryLight: '#EFF6FF',    // Ice Blue Wash
  primaryBorder: '#BFDBFE',

  // Typography
  textPrimary: '#0F172A',     // Slate Dark
  textSecondary: '#64748B',   // Muted Slate
  textTertiary: '#94A3B8',    // Light Slate
  textInverse: '#FFFFFF',
  textLink: '#2563EB',

  // Borders & Dividers
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  borderFocus: '#2563EB',

  // Feedback & Status
  statusSuccess: '#16A34A',
  statusSuccessLight: '#F0FDF4',
  statusWarning: '#D97706',
  statusWarningLight: '#FFFBEB',
  statusDanger: '#EF4444',
  statusDangerLight: '#FEF2F2',
  statusNeutral: '#64748B',
  statusNeutralLight: '#F1F5F9',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.4)',
};

export const darkColors: ColorTheme = {
  // Backgrounds & Surfaces
  background: '#0B0F19',       // Deep Midnight Slate
  surface: '#111827',          // Dark Card Surface
  surfaceSubtle: '#1E293B',
  surfaceElevated: '#1F2937',

  // Primary Blue Accents
  primary: '#3B82F6',          // Luminous Electric Blue
  primaryHover: '#60A5FA',
  primaryLight: '#1E3A8A33',   // Subtle Midnight Blue Wash
  primaryBorder: '#2563EB',

  // Typography
  textPrimary: '#F8FAFC',      // Crisp Pure Slate
  textSecondary: '#94A3B8',    // Cool Slate
  textTertiary: '#64748B',     // Dim Slate
  textInverse: '#0B0F19',
  textLink: '#60A5FA',

  // Borders & Dividers
  border: '#334155',
  borderSubtle: '#1E293B',
  borderFocus: '#60A5FA',

  // Feedback & Status
  statusSuccess: '#22C55E',
  statusSuccessLight: '#052E16',
  statusWarning: '#FBBF24',
  statusWarningLight: '#451A03',
  statusDanger: '#F87171',
  statusDangerLight: '#450A0A',
  statusNeutral: '#94A3B8',
  statusNeutralLight: '#1E293B',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export type ThemeAccent = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'teal';

export interface AccentColorPalette {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryBorder: string;
  borderFocus: string;
  textLink: string;
}

export interface ThemeAccentOption {
  id: ThemeAccent;
  name: string;
  swatch: string;
  light: AccentColorPalette;
  dark: AccentColorPalette;
}

export const THEME_ACCENTS: ThemeAccentOption[] = [
  {
    id: 'blue',
    name: 'Cobalt Blue',
    swatch: '#2563EB',
    light: {
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primaryLight: '#EFF6FF',
      primaryBorder: '#BFDBFE',
      borderFocus: '#2563EB',
      textLink: '#2563EB',
    },
    dark: {
      primary: '#3B82F6',
      primaryHover: '#60A5FA',
      primaryLight: '#1E3A8A33',
      primaryBorder: '#2563EB',
      borderFocus: '#60A5FA',
      textLink: '#60A5FA',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    swatch: '#059669',
    light: {
      primary: '#059669',
      primaryHover: '#047857',
      primaryLight: '#ECFDF5',
      primaryBorder: '#A7F3D0',
      borderFocus: '#059669',
      textLink: '#059669',
    },
    dark: {
      primary: '#10B981',
      primaryHover: '#34D399',
      primaryLight: '#064E3B33',
      primaryBorder: '#059669',
      borderFocus: '#34D399',
      textLink: '#34D399',
    },
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    swatch: '#7C3AED',
    light: {
      primary: '#7C3AED',
      primaryHover: '#6D28D9',
      primaryLight: '#F5F3FF',
      primaryBorder: '#DDD6FE',
      borderFocus: '#7C3AED',
      textLink: '#7C3AED',
    },
    dark: {
      primary: '#8B5CF6',
      primaryHover: '#A78BFA',
      primaryLight: '#4C1D9533',
      primaryBorder: '#7C3AED',
      borderFocus: '#A78BFA',
      textLink: '#A78BFA',
    },
  },
  {
    id: 'rose',
    name: 'Rose Crimson',
    swatch: '#E11D48',
    light: {
      primary: '#E11D48',
      primaryHover: '#BE123C',
      primaryLight: '#FFF1F2',
      primaryBorder: '#FECDD3',
      borderFocus: '#E11D48',
      textLink: '#E11D48',
    },
    dark: {
      primary: '#F43F5E',
      primaryHover: '#FB7185',
      primaryLight: '#88133733',
      primaryBorder: '#E11D48',
      borderFocus: '#FB7185',
      textLink: '#FB7185',
    },
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    swatch: '#D97706',
    light: {
      primary: '#D97706',
      primaryHover: '#B45309',
      primaryLight: '#FFFBEB',
      primaryBorder: '#FDE68A',
      borderFocus: '#D97706',
      textLink: '#D97706',
    },
    dark: {
      primary: '#F59E0B',
      primaryHover: '#FBBF24',
      primaryLight: '#78350F33',
      primaryBorder: '#D97706',
      borderFocus: '#FBBF24',
      textLink: '#FBBF24',
    },
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    swatch: '#0D9488',
    light: {
      primary: '#0D9488',
      primaryHover: '#0F766E',
      primaryLight: '#F0FDFA',
      primaryBorder: '#99F6E4',
      borderFocus: '#0D9488',
      textLink: '#0D9488',
    },
    dark: {
      primary: '#14B8A6',
      primaryHover: '#2DD4BF',
      primaryLight: '#134E4A33',
      primaryBorder: '#0D9488',
      borderFocus: '#2DD4BF',
      textLink: '#2DD4BF',
    },
  },
];
