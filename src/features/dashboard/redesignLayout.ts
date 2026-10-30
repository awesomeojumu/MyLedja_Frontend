import type { DashboardLayout as StoredDashboardLayout, WorkspaceSettings } from '@/data/workspace/model';
import type { SizeClass } from '@/design/size';
import type { TextKey } from '@/i18n';

/**
 * Live Figma Mobile Edit Home `2:1199` + Phone Home `2:727`.
 * Default On: left to spend → net worth → coming up → budget → recent → goals.
 * Default Hidden: averages, investments, debts, health, cash flow.
 */
export const REDESIGN_CARD_IDS = [
  'leftToSpend',
  'netWorth',
  'comingUp',
  'budget',
  'recent',
  'goals',
  'averages',
  'investments',
  'debts',
  'health',
  'cashFlow',
] as const;

export type RedesignCardId = (typeof REDESIGN_CARD_IDS)[number];

export type RedesignDashboardLayout = {
  order: RedesignCardId[];
  hidden: RedesignCardId[];
};

export const DEFAULT_REDESIGN_HIDDEN: RedesignCardId[] = [
  'averages',
  'investments',
  'debts',
  'health',
  'cashFlow',
];

export const DEFAULT_REDESIGN_LAYOUT: RedesignDashboardLayout = {
  order: [...REDESIGN_CARD_IDS],
  hidden: [...DEFAULT_REDESIGN_HIDDEN],
};

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
export function resolveRedesignLayout(raw?: StoredDashboardLayout): RedesignDashboardLayout {
  const hasRedesign =
    (raw?.order ?? []).some(isCardId) || (raw?.hidden ?? []).some(isCardId);
  if (!raw || !hasRedesign) {
    return { order: [...REDESIGN_CARD_IDS], hidden: [...DEFAULT_REDESIGN_HIDDEN] };
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

export function visibleRedesignCards(layout: RedesignDashboardLayout): RedesignCardId[] {
  const resolved = resolveRedesignLayout(layout);
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

function layoutDeviceKind(size: SizeClass): 'phone' | 'larger' {
  return size === 'phone' ? 'phone' : 'larger';
}

export function resolveRedesignLayoutForDevice(settings: WorkspaceSettings | undefined, size: SizeClass): RedesignDashboardLayout {
  const kind = layoutDeviceKind(size);
  const raw = kind === 'phone' ? settings?.dashboardLayoutPhone ?? settings?.dashboardLayout : settings?.dashboardLayout;
  return resolveRedesignLayout(raw);
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
