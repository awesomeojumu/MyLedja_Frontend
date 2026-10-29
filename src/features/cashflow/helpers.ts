import type { Snapshot } from '@/data/workspace/repository';
import { catalogue, t, type TextKey } from '@/i18n';
import { roundHalfAwayFromZero } from '@/money';

import { changeBasisPoints, previousRange, type CashFlowBand } from './engine';
import { cashFlowFor } from './local';

/** A band with its name and its share of income. */
export type FlowBand = CashFlowBand & { label: string; shareBasisPoints: bigint | null };

export type FlowGroup = {
  key: string;
  label: string;
  kind: CashFlowBand['kind'];
  amount: bigint;
  previous: bigint;
  shareBasisPoints: bigint | null;
  categories: { categoryId: string; label: string; amount: bigint }[];
};

export type CashFlowPage = {
  from: string;
  to: string;
  bands: FlowBand[];
  groups: FlowGroup[];
  tiles: { in: bigint; out: bigint; savedBasisPoints: bigint | null };
};

/** Money that isn't income or spending is named by what it is (DESIGN.md 9.2). */
export function kindLabel(kind: CashFlowBand['kind']): string {
  return t(`cashFlow.kind.${kind}` as TextKey);
}

function groupName(group: string | null): string {
  if (!group) return t('cashFlow.kind.spending');
  return group in catalogue ? t(group as TextKey) : group;
}

/** "+12.5%" / "−3.0%" / "0.0%" from basis points. */
export function percentText(bp: bigint | null): string {
  if (bp === null) return '';
  const sign = bp > 0n ? '+' : bp < 0n ? '−' : '';
  const abs = bp < 0n ? -bp : bp;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole}.${frac.toString().padStart(2, '0').slice(0, 1)}%`;
}

/** The Cash flow page's numbers, the same shape as the server's (TECH-SPEC 6.12). */
export function cashFlowPage(
  snapshot: Snapshot,
  q: { from: string; to: string; accountIds?: string[]; includeTransfers: boolean },
): CashFlowPage {
  const prev = previousRange(q.from, q.to);
  const now = cashFlowFor(snapshot, q);
  const before = cashFlowFor(snapshot, { ...q, ...prev });
  const income = now.filter((b) => b.kind === 'income').reduce((s, b) => s + b.amount, 0n);
  const share = (v: bigint) => (income > 0n ? roundHalfAwayFromZero(v * 10_000n, income) : null);
  const names = new Map(snapshot.categories.map((c) => [c.id, c.name]));
  const labelOf = (b: CashFlowBand) => (b.categoryId ? (names.get(b.categoryId) ?? '') : kindLabel(b.kind));
  const groupKey = (b: CashFlowBand) => (b.kind === 'spending' ? `group:${b.groupId ?? 'none'}` : b.kind);

  const groups = new Map<string, FlowGroup>();
  for (const b of now) {
    if (b.side !== 'out') continue;
    const key = groupKey(b);
    const g = groups.get(key) ?? {
      key,
      label: b.kind === 'spending' ? groupName(b.groupId) : kindLabel(b.kind),
      kind: b.kind,
      amount: 0n,
      previous: 0n,
      shareBasisPoints: null,
      categories: [],
    };
    g.amount += b.amount;
    if (b.categoryId) g.categories.push({ categoryId: b.categoryId, label: labelOf(b), amount: b.amount });
    groups.set(key, g);
  }
  for (const b of before) {
    const g = groups.get(groupKey(b));
    if (g && b.side === 'out') g.previous += b.amount;
  }
  const totalIn = now.filter((b) => b.side === 'in').reduce((s, b) => s + b.amount, 0n);
  const left = now.find((b) => b.kind === 'left_over')?.amount ?? 0n;
  const order = (g: FlowGroup) => (g.kind === 'spending' ? 0 : g.kind === 'left_over' ? 2 : 1);
  return {
    from: q.from,
    to: q.to,
    bands: now.map((b) => ({ ...b, label: labelOf(b), shareBasisPoints: share(b.amount) })),
    groups: [...groups.values()]
      .map((g) => ({
        ...g,
        shareBasisPoints: share(g.amount),
        categories: g.categories.sort((a, b) => (b.amount > a.amount ? 1 : -1)),
      }))
      .sort((a, b) => order(a) - order(b) || (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0)),
    tiles: { in: totalIn, out: totalIn - left, savedBasisPoints: share(left) },
  };
}

export { changeBasisPoints };

/** Transactions deep-link for a band or category (P22-03). */
export function drillHref(q: { from: string; to: string; categoryId?: string; accountId?: string; accountIds?: string[] }): string {
  const params = new URLSearchParams({ from: q.from, to: q.to });
  if (q.categoryId) params.set('category', q.categoryId);
  if (q.accountId) params.set('account', q.accountId);
  else if (q.accountIds?.length === 1) params.set('account', q.accountIds[0]!);
  return `/transactions?${params.toString()}`;
}

export function rangeCaption(from: string, to: string): string {
  return t('cashFlow.rangeCaption', { from, to });
}
