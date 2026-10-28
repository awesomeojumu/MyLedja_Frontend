import type { Href } from 'expo-router';
import type { TextKey } from '@/i18n';

export type NavItem = {
  key: string;
  label: TextKey;
  phoneLabel?: TextKey;
  href: Href;
  icon: 'dashboard' | 'accounts' | 'transactions' | 'budget' | 'payees' | 'rules' | 'settings' | 'goals' | 'plan' | 'income' | 'debts' | 'notifications';
};

/**
 * Only pages that have shipped appear in navigation (DESIGN.md principle 12, G-01).
 * Each phase adds its pages here as they ship.
 */
/** Everyday pages in the sidebar (DESIGN.md 3.2). Accounts stay here; phone bottom bar uses PHONE_BOTTOM_PAGES. */
export const SHIPPED_PAGES: NavItem[] = [
  { key: 'dashboard', label: 'nav.dashboard', phoneLabel: 'nav.home', href: '/', icon: 'dashboard' },
  { key: 'transactions', label: 'nav.transactions', href: '/transactions', icon: 'transactions' },
  { key: 'budget', label: 'nav.budget', href: '/budget', icon: 'budget' },
  { key: 'accounts', label: 'nav.accounts', href: '/accounts', icon: 'accounts' },
];

/** Phone bottom bar: Home · Transactions · (+) · Budget · Plan (DESIGN.md 3.3). */
export const PHONE_BOTTOM_PAGES: NavItem[] = [
  { key: 'dashboard', label: 'nav.dashboard', phoneLabel: 'nav.home', href: '/', icon: 'dashboard' },
  { key: 'transactions', label: 'nav.transactions', href: '/transactions', icon: 'transactions' },
  { key: 'budget', label: 'nav.budget', href: '/budget', icon: 'budget' },
  { key: 'plan', label: 'nav.planBills', phoneLabel: 'nav.plan', href: '/plan', icon: 'plan' },
];

/** Manage section in the drawer (DESIGN.md 3.2); not in the phone bottom bar. */
export const MANAGE_PAGES: NavItem[] = [
  { key: 'notifications', label: 'nav.notifications', href: '/notifications', icon: 'notifications' },
  { key: 'payees', label: 'nav.payees', href: '/payees', icon: 'payees' },
  { key: 'rules', label: 'nav.rules', href: '/rules', icon: 'rules' },
  { key: 'settings', label: 'nav.settings', href: '/settings', icon: 'settings' },
];

/** Plan section in the drawer (DESIGN.md 3.2). */
export const PLAN_PAGES: NavItem[] = [
  { key: 'plan', label: 'nav.planBills', href: '/plan', icon: 'plan' },
  { key: 'income', label: 'nav.income', href: '/income', icon: 'income' },
  { key: 'goals', label: 'nav.goals', href: '/goals', icon: 'goals' },
  { key: 'debts', label: 'nav.debts', href: '/debts', icon: 'debts' },
];
