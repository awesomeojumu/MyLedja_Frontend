import type { DashboardLayout as StoredDashboardLayout, WorkspaceSettings } from '@/data/workspace/model';
import type { SizeClass } from '@/design/size';
import type { TextKey } from '@/i18n';

/**
 * Live Figma card set.
 * Order matches Tablet/Web Home (`11:922` / `1:141`): Left → Net worth → Monthly averages → …
 * Phone Home `2:727` / Edit `2:1199`: averages On=False by default (same order when toggled on).
 */
export const REDESIGN_CARD_IDS = [
  'leftToSpend',
  'netWorth',
  'averages',
  'comingUp',
  'budget',
  'recent',
  'goals',
  'investments',
  'debts',
  'health',
  'cashFlow',
] as const;

export type RedesignCardId = (typeof REDESIGN_CARD_IDS)[number];

export type RedesignDeviceKind = 'phone' | 'larger';

export type RedesignDashboardLayout = {
  order: RedesignCardId[];
  hidden: RedesignCardId[];
};

/** Phone Edit Home `2:1199`: averages Off. */
export const DEFAULT_REDESIGN_HIDDEN_PHONE: RedesignCardId[] = [
  'averages',
  'investments',
  'debts',
  'health',
  'cashFlow',
];

/** Tablet/Web Home show Monthly averages by default. */
export const DEFAULT_REDESIGN_HIDDEN_LARGER: RedesignCardId[] = [
  'investments',
  'debts',
  'health',
  'cashFlow',
];

/** @deprecated Prefer defaultRedesignHidden('phone') — kept for call sites that mean phone. */
export const DEFAULT_REDESIGN_HIDDEN = DEFAULT_REDESIGN_HIDDEN_PHONE;

export function defaultRedesignHidden(kind: RedesignDeviceKind): RedesignCardId[] {
  return kind === 'phone' ? [...DEFAULT_REDESIGN_HIDDEN_PHONE] : [...DEFAULT_REDESIGN_HIDDEN_LARGER];
}

export function defaultRedesignLayout(kind: RedesignDeviceKind = 'phone'): RedesignDashboardLayout {
  return { order: [...REDESIGN_CARD_IDS], hidden: defaultRedesignHidden(kind) };
}

export const DEFAULT_REDESIGN_LAYOUT: RedesignDashboardLayout = defaultRedesignLayout('phone');

const CARD_LABELS: Record<RedesignCardId, TextKey> = {
  leftToSpend: 'dashboard.card.leftToSpend',
  netWorth: 'dashboard.card.netWorth',
  averages: 'dashboard.redesign.card.averages',
  comingUp: 'dashboard.card.comingUp',
  budget: 'dashboard.redesign.card.budget',
  recent: 'dashboard.redesign.card.recent',
  goals: 'dashboard.card.goals',
  investments: 'dashboard.card.investments',
  debts: 'dashboard.card.debts',
  health: 'dashboard.card.health',
  cashFlow: 'dashboard.redesign.card.cashFlow',
};

export function redesignCardLabel(id: RedesignCardId): TextKey {
  return CARD_LABELS[id];
}

function isCardId(value: string): value is RedesignCardId {
  return (REDESIGN_CARD_IDS as readonly string[]).includes(value);
}

/** Merge saved layout with redesign defaults; drop legacy card ids. */
export function resolveRedesignLayout(
  raw?: StoredDashboardLayout,
  kind: RedesignDeviceKind = 'phone',
): RedesignDashboardLayout {
  const hasRedesign =
    (raw?.order ?? []).some(isCardId) || (raw?.hidden ?? []).some(isCardId);
  if (!raw || !hasRedesign) {
    return defaultRedesignLayout(kind);
  }

  const hiddenSet = new Set((raw.hidden ?? []).filter(isCardId));
  const seen = new Set<RedesignCardId>();
  const order: RedesignCardId[] = [];
  for (const id of raw.order ?? []) {
    if (!isCardId(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of REDESIGN_CARD_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  return { order, hidden: REDESIGN_CARD_IDS.filter((id) => hiddenSet.has(id)) };
}

export function toStoredRedesignLayout(layout: RedesignDashboardLayout): StoredDashboardLayout {
  return { order: [...layout.order], hidden: [...layout.hidden] };
}

export function visibleRedesignCards(
  layout: RedesignDashboardLayout,
  kind: RedesignDeviceKind = 'phone',
): RedesignCardId[] {
  const resolved = resolveRedesignLayout(layout, kind);
  const hidden = new Set(resolved.hidden);
  return resolved.order.filter((id) => !hidden.has(id));
}

export function moveRedesignCard(order: RedesignCardId[], id: RedesignCardId, direction: 'up' | 'down'): RedesignCardId[] {
  const idx = order.indexOf(id);
  if (idx < 0) return order;
  const next = direction === 'up' ? idx - 1 : idx + 1;
  if (next < 0 || next >= order.length) return order;
  const copy = [...order];
  [copy[idx], copy[next]] = [copy[next]!, copy[idx]!];
  return copy;
}

export function toggleRedesignHidden(hidden: RedesignCardId[], id: RedesignCardId, on: boolean): RedesignCardId[] {
  const set = new Set(hidden);
  if (on) set.delete(id);
  else set.add(id);
  return REDESIGN_CARD_IDS.filter((card) => set.has(card));
}

export function reorderRedesignCard(order: RedesignCardId[], fromId: RedesignCardId, toId: RedesignCardId): RedesignCardId[] {
  if (fromId === toId) return order;
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0) return order;
  const copy = [...order];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

export function layoutDeviceKind(size: SizeClass): RedesignDeviceKind {
  return size === 'phone' ? 'phone' : 'larger';
}

export function resolveRedesignLayoutForDevice(settings: WorkspaceSettings | undefined, size: SizeClass): RedesignDashboardLayout {
  const kind = layoutDeviceKind(size);
  const raw = kind === 'phone' ? settings?.dashboardLayoutPhone ?? settings?.dashboardLayout : settings?.dashboardLayout;
  return resolveRedesignLayout(raw, kind);
}

export function withStoredRedesignLayoutForDevice(
  settings: WorkspaceSettings,
  size: SizeClass,
  layout: RedesignDashboardLayout,
): WorkspaceSettings {
  const stored = toStoredRedesignLayout(layout);
  if (layoutDeviceKind(size) === 'phone') return { ...settings, dashboardLayoutPhone: stored };
  return { ...settings, dashboardLayout: stored };
}

/** Web/tablet span hints (12-col). */
export function redesignCardSpan(id: RedesignCardId, size: SizeClass): number {
  if (size === 'phone') return 12;
  if (size === 'tablet') {
    if (id === 'leftToSpend' || id === 'netWorth' || id === 'averages') return 12;
    return 6;
  }
  if (id === 'leftToSpend') return 5;
  if (id === 'netWorth') return 7;
  if (id === 'averages') return 12;
  return 6;
}
