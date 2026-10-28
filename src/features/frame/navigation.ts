import type { Href } from 'expo-router';
import type { TextKey } from '@/i18n';

export type NavItem = { key: string; label: TextKey; phoneLabel?: TextKey; href: Href; icon: 'dashboard' };

/**
 * Only pages that have shipped appear in navigation (DESIGN.md principle 12, G-01).
 * Each phase adds its pages here as they ship.
 */
export const SHIPPED_PAGES: NavItem[] = [{ key: 'dashboard', label: 'nav.dashboard', phoneLabel: 'nav.home', href: '/', icon: 'dashboard' }];

/** Add transaction ships in Phase 1 (F1.3); until then the Add buttons stay out of the frame. */
export const ADD_TRANSACTION_SHIPPED = false;
