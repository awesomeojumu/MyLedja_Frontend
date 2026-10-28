import type { Href } from 'expo-router';
import type { TextKey } from '@/i18n';

export type NavItem = { key: string; label: TextKey; phoneLabel?: TextKey; href: Href; icon: 'dashboard' | 'accounts' | 'transactions' | 'budget' | 'payees' | 'settings' };

/**
 * Only pages that have shipped appear in navigation (DESIGN.md principle 12, G-01).
 * Each phase adds its pages here as they ship.
 */
export const SHIPPED_PAGES: NavItem[] = [
  { key: 'dashboard', label: 'nav.dashboard', phoneLabel: 'nav.home', href: '/', icon: 'dashboard' },
  { key: 'transactions', label: 'nav.transactions', href: '/transactions', icon: 'transactions' },
  { key: 'budget', label: 'nav.budget', href: '/budget', icon: 'budget' },
  { key: 'accounts', label: 'nav.accounts', href: '/accounts', icon: 'accounts' },
];

/** Manage section in the drawer (DESIGN.md 3.2); not in the phone bottom bar. */
export const MANAGE_PAGES: NavItem[] = [
  { key: 'payees', label: 'nav.payees', href: '/payees', icon: 'payees' },
  { key: 'settings', label: 'nav.settings', href: '/settings', icon: 'settings' },
];
