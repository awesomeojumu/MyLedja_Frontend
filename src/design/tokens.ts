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
