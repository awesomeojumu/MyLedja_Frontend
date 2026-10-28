import tokens from './tokens.json';

export type ColorToken = keyof typeof tokens.color;
const c = tokens.color;

export type Theme = {
  name: 'light' | 'dark';
  page: string;
  card: string;
  hover: string;
  border: string;
  text: string;
  textSecondary: string;
  textHelper: string;
  /** Helper text on a hover row or table header. See docs/QUESTIONS.md Q-1. */
  textHelperOnHover: string;
  primaryFill: string;
  onPrimaryFill: string;
  link: string;
  focus: string;
  gold: string;
  goldLabel: string;
  inputBorder: string;
  error: string;
  tagFill: string;
  tagText: string;
  sidebar: string;
  onSidebar: string;
};

export const lightTheme: Theme = {
  name: 'light',
  page: c['canvas-soft'],
  card: c.canvas,
  hover: c['canvas-soft'],
  border: c.hairline,
  text: c.ink,
  textSecondary: c['ink-secondary'],
  textHelper: c['ink-mute'],
  textHelperOnHover: c['ink-mute'],
  primaryFill: c.primary,
  onPrimaryFill: c['on-primary'],
  link: c.primary,
  focus: c['primary-deep'],
  gold: c.gold,
  goldLabel: c['gold-text'],
  inputBorder: c['hairline-input'],
  error: c.ruby,
  tagFill: c['primary-bg-subdued-hover'],
  tagText: c['primary-deep'],
  sidebar: c['brand-dark-900'],
  onSidebar: c['on-primary'],
};

export const darkTheme: Theme = {
  name: 'dark',
  page: c['brand-dark-900'],
  card: c.ink,
  hover: c['dark-hover'],
  border: c['primary-deep'],
  text: c['on-primary'],
  textSecondary: c['primary-bg-subdued-hover'],
  textHelper: c['hairline-input'],
  textHelperOnHover: c['primary-bg-subdued-hover'],
  primaryFill: c['on-primary'],
  onPrimaryFill: c.primary,
  link: c['primary-bg-subdued-hover'],
  focus: c['primary-bg-subdued-hover'],
  gold: c.gold,
  goldLabel: c['gold-light'],
  inputBorder: c['hairline-input'],
  error: c.ruby,
  tagFill: c['primary-bg-subdued-hover'],
  tagText: c['primary-deep'],
  sidebar: c['brand-dark-900'],
  onSidebar: c['on-primary'],
};

export { tokens };
export const spacing = tokens.spacing;
export const radius = tokens.radius;
export const motion = tokens.motion;
