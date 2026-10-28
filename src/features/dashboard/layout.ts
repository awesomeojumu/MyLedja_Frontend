import type { DashboardLayout as StoredDashboardLayout } from '@/data/workspace/model';
import type { TextKey } from '@/i18n';

/** DESIGN.md page 5 cards (Phase 1–2; Health and Investments are Phase 5). */
export const DASHBOARD_CARD_IDS = [
  'checklist',
  'netWorth',
  'leftToSpend',
  'statTiles',
  'incomeVsSpending',
  'spendingTrend',
  'budgetProgress',
  'comingUp',
  'whereItWent',
  'recent',
  'goals',
  'debts',
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARD_IDS)[number];

export type DashboardLayout = {
  order: DashboardCardId[];
  hidden: DashboardCardId[];
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  order: [...DASHBOARD_CARD_IDS],
  hidden: [],
};

const CARD_LABELS: Record<DashboardCardId, TextKey> = {
  checklist: 'dashboard.card.checklist',
  netWorth: 'dashboard.card.netWorth',
  leftToSpend: 'dashboard.card.leftToSpend',
  statTiles: 'dashboard.card.statTiles',
  incomeVsSpending: 'dashboard.card.incomeVsSpending',
  spendingTrend: 'dashboard.card.spendingTrend',
  budgetProgress: 'dashboard.card.budgetProgress',
  comingUp: 'dashboard.card.comingUp',
  whereItWent: 'dashboard.card.whereItWent',
  recent: 'dashboard.card.recent',
  goals: 'dashboard.card.goals',
  debts: 'dashboard.card.debts',
};

export function dashboardCardLabel(id: DashboardCardId): TextKey {
  return CARD_LABELS[id];
}

function isCardId(value: string): value is DashboardCardId {
  return (DASHBOARD_CARD_IDS as readonly string[]).includes(value);
}

/** Merge saved layout with defaults so new cards appear and unknown ids drop off. */
export function resolveDashboardLayout(raw?: StoredDashboardLayout): DashboardLayout {
  const hidden = new Set((raw?.hidden ?? []).filter(isCardId));
  const seen = new Set<DashboardCardId>();
  const order: DashboardCardId[] = [];
  for (const id of raw?.order ?? []) {
    if (!isCardId(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of DASHBOARD_CARD_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  return { order, hidden: [...hidden] };
}

export function toStoredLayout(layout: DashboardLayout): StoredDashboardLayout {
  return { order: [...layout.order], hidden: [...layout.hidden] };
}

export function visibleDashboardCards(layout: DashboardLayout): DashboardCardId[] {
  const resolved = resolveDashboardLayout(layout);
  const hidden = new Set(resolved.hidden);
  return resolved.order.filter((id) => !hidden.has(id));
}

export function moveCard(order: DashboardCardId[], id: DashboardCardId, direction: 'up' | 'down'): DashboardCardId[] {
  const idx = order.indexOf(id);
  if (idx < 0) return order;
  const next = direction === 'up' ? idx - 1 : idx + 1;
  if (next < 0 || next >= order.length) return order;
  const copy = [...order];
  [copy[idx], copy[next]] = [copy[next]!, copy[idx]!];
  return copy;
}

export function toggleCardHidden(hidden: DashboardCardId[], id: DashboardCardId, on: boolean): DashboardCardId[] {
  const set = new Set(hidden);
  if (on) set.delete(id);
  else set.add(id);
  return DASHBOARD_CARD_IDS.filter((card) => set.has(card));
}
