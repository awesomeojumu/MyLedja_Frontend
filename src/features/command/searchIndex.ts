import type { Snapshot } from '@/data/workspace/repository';
import { monthLabel } from '@/features/budget/helpers';
import { MANAGE_PAGES, PLAN_PAGES, SHIPPED_PAGES, type NavItem } from '@/features/frame/navigation';
import { rowsFor, today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';

export const SEARCH_GROUPS = [
  'actions',
  'pages',
  'transactions',
  'accounts',
  'categories',
  'payees',
  'goals',
  'debts',
  'holdings',
] as const;

export type SearchGroupId = (typeof SEARCH_GROUPS)[number];

export type SearchAction =
  | { kind: 'add'; add: 'expense' | 'income' | 'transfer' }
  | { kind: 'navigate'; href: string }
  | { kind: 'reconcile'; accountId: string }
  | { kind: 'mark-bill-paid'; recurringId: string }
  | { kind: 'budget-month'; month: string }
  | { kind: 'see-all-transactions'; query: string }
  | { kind: 'recent'; query: string };

export type SearchHit = {
  id: string;
  group: SearchGroupId;
  label: string;
  detail?: string;
  action: SearchAction;
};

export type SearchGroupResult = {
  id: SearchGroupId;
  hits: SearchHit[];
  /** True when more than 5 matches existed before capping. */
  hasMore: boolean;
};

const PER_GROUP = 5;

const FULL_MONTHS: { month: number; names: string[] }[] = [
  { month: 1, names: ['january', 'jan'] },
  { month: 2, names: ['february', 'feb'] },
  { month: 3, names: ['march', 'mar'] },
  { month: 4, names: ['april', 'apr'] },
  { month: 5, names: ['may'] },
  { month: 6, names: ['june', 'jun'] },
  { month: 7, names: ['july', 'jul'] },
  { month: 8, names: ['august', 'aug'] },
  { month: 9, names: ['september', 'sep', 'sept'] },
  { month: 10, names: ['october', 'oct'] },
  { month: 11, names: ['november', 'nov'] },
  { month: 12, names: ['december', 'dec'] },
];

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

function cap(hits: SearchHit[]): { hits: SearchHit[]; hasMore: boolean } {
  return { hits: hits.slice(0, PER_GROUP), hasMore: hits.length > PER_GROUP };
}

function pageItems(): NavItem[] {
  return [...SHIPPED_PAGES, ...MANAGE_PAGES, ...PLAN_PAGES];
}

function matchedMonths(query: string, now: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const year = Number(now.slice(0, 4));
  const out: string[] = [];
  for (const m of FULL_MONTHS) {
    if (m.names.some((n) => n.startsWith(q) || q.startsWith(n))) {
      out.push(`${year}-${String(m.month).padStart(2, '0')}`);
    }
  }
  return out;
}

/** Offline command-bar search over the device snapshot (PU-03). */
export function searchWorkspace(snapshot: Snapshot, query: string, now = today()): SearchGroupResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const actions: SearchHit[] = [];
  const addActions: { add: 'expense' | 'income' | 'transfer'; label: TextKey; needles: string[] }[] = [
    { add: 'expense', label: 'command.action.addExpense', needles: ['add expense', 'expense', 'add'] },
    { add: 'income', label: 'command.action.addIncome', needles: ['add income', 'income', 'add'] },
    { add: 'transfer', label: 'command.action.addTransfer', needles: ['add transfer', 'transfer', 'add'] },
  ];
  for (const a of addActions) {
    if (a.needles.some((n) => n === q || n.startsWith(q) || q.startsWith(n))) {
      actions.push({
        id: `action-add-${a.add}`,
        group: 'actions',
        label: t(a.label),
        action: { kind: 'add', add: a.add },
      });
    }
  }

  for (const month of matchedMonths(q, now)) {
    actions.push({
      id: `action-budget-${month}`,
      group: 'actions',
      label: t('command.action.budgetMonth', { month: monthLabel(month) }),
      action: { kind: 'budget-month', month },
    });
  }

  for (const account of snapshot.accounts.filter((a) => !a.archived)) {
    if (includes(account.name, q)) {
      actions.push({
        id: `action-reconcile-${account.id}`,
        group: 'actions',
        label: t('command.action.reconcile', { account: account.name }),
        action: { kind: 'reconcile', accountId: account.id },
      });
    }
  }

  for (const bill of snapshot.recurring.filter((r) => !r.cancelled && (r.kind === 'bill' || r.kind === 'subscription'))) {
    if (includes(bill.name, q)) {
      actions.push({
        id: `action-bill-${bill.id}`,
        group: 'actions',
        label: t('command.action.markBillPaid', { bill: bill.name }),
        detail: bill.name,
        action: { kind: 'mark-bill-paid', recurringId: bill.id },
      });
    }
  }

  const pages: SearchHit[] = [];
  for (const item of pageItems()) {
    const label = t(item.label);
    if (includes(label, q) || includes(item.key, q)) {
      pages.push({
        id: `page-${item.key}`,
        group: 'pages',
        label,
        action: { kind: 'navigate', href: String(item.href) },
      });
    }
  }

  const txRows = rowsFor(snapshot).filter((r) => {
    if (r.event.type === 'opening_balance') return false;
    return includes(r.title, q) || includes(r.category, q) || includes(r.event.notes ?? '', q);
  });
  const transactions: SearchHit[] = txRows.map((r) => ({
    id: `tx-${r.event.id}`,
    group: 'transactions' as const,
    label: r.title,
    detail: `${r.category} · ${formatNaira(r.amount < 0n ? -r.amount : r.amount)}`,
    action: { kind: 'navigate' as const, href: `/transactions?tx=${r.event.id}` },
  }));

  const accounts: SearchHit[] = snapshot.accounts
    .filter((a) => !a.archived && includes(a.name, q))
    .map((a) => ({
      id: `account-${a.id}`,
      group: 'accounts' as const,
      label: a.name,
      action: { kind: 'navigate' as const, href: `/accounts/${a.id}` },
    }));

  const categories: SearchHit[] = snapshot.categories
    .filter((c) => includes(c.name, q))
    .map((c) => ({
      id: `category-${c.id}`,
      group: 'categories' as const,
      label: c.name,
      action: { kind: 'navigate' as const, href: `/budget/category/${c.id}` },
    }));

  const payees: SearchHit[] = snapshot.payees
    .filter((p) => includes(p.name, q) || (p.aliases ?? []).some((a) => includes(a, q)))
    .map((p) => ({
      id: `payee-${p.id}`,
      group: 'payees' as const,
      label: p.name,
      action: { kind: 'navigate' as const, href: '/payees' },
    }));

  const goals: SearchHit[] = snapshot.goals
    .filter((g) => includes(g.name, q))
    .map((g) => ({
      id: `goal-${g.id}`,
      group: 'goals' as const,
      label: g.name,
      action: { kind: 'navigate' as const, href: '/goals' },
    }));

  const debts: SearchHit[] = snapshot.debts
    .filter((d) => includes(d.name, q))
    .map((d) => ({
      id: `debt-${d.id}`,
      group: 'debts' as const,
      label: d.name,
      action: { kind: 'navigate' as const, href: `/debts/${d.id}` },
    }));

  // Holdings ship later (F5); keep the group for the command-bar shape.
  const holdings: SearchHit[] = [];

  const packed: { id: SearchGroupId; hits: SearchHit[] }[] = [
    { id: 'actions', hits: actions },
    { id: 'pages', hits: pages },
    { id: 'transactions', hits: transactions },
    { id: 'accounts', hits: accounts },
    { id: 'categories', hits: categories },
    { id: 'payees', hits: payees },
    { id: 'goals', hits: goals },
    { id: 'debts', hits: debts },
    { id: 'holdings', hits: holdings },
  ];

  const out: SearchGroupResult[] = [];
  for (const g of packed) {
    if (g.hits.length === 0) continue;
    const { hits, hasMore } = cap(g.hits);
    if (g.id === 'transactions' && hasMore) {
      hits.push({
        id: 'see-all-transactions',
        group: 'transactions',
        label: t('command.seeAllTransactions'),
        action: { kind: 'see-all-transactions', query: query.trim() },
      });
    }
    out.push({ id: g.id, hits, hasMore });
  }
  return out;
}

/** Flatten groups in display order for ↑↓ keyboard movement. */
export function flattenHits(groups: SearchGroupResult[]): SearchHit[] {
  return groups.flatMap((g) => g.hits);
}

const RECENT_KEY = 'command.recent';
const RECENT_MAX = 8;
let recentMemory: string[] = [];

export function getRecentSearches(): string[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(`myledja:${RECENT_KEY}`);
      if (raw) recentMemory = JSON.parse(raw) as string[];
    } catch {
      /* ignore */
    }
  }
  return recentMemory;
}

export function rememberSearch(query: string): void {
  const q = query.trim();
  if (!q) return;
  recentMemory = [q, ...recentMemory.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`myledja:${RECENT_KEY}`, JSON.stringify(recentMemory));
    } catch {
      /* ignore */
    }
  }
}

export function clearRecentSearchesForTests(): void {
  recentMemory = [];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(`myledja:${RECENT_KEY}`);
    } catch {
      /* ignore */
    }
  }
}
