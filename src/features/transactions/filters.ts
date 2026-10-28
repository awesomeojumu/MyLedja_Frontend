import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import type { EventType } from '@/ledger';

import type { Row } from './helpers';

export type TxFilters = {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  categoryId?: string;
  payeeId?: string;
  type?: EventType;
  amountMin?: bigint;
  amountMax?: bigint;
  uncategorized?: boolean;
  hasReceipt?: boolean;
};

export function emptyFilters(): TxFilters {
  return {};
}

export function applyFilters(row: Row, filters: TxFilters, snapshot: Snapshot): boolean {
  const { event } = row;
  if (filters.dateFrom && event.date < filters.dateFrom) return false;
  if (filters.dateTo && event.date > filters.dateTo) return false;
  if (filters.type && event.type !== filters.type) return false;
  if (filters.payeeId && event.payeeId !== filters.payeeId) return false;

  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const moneyAccount = event.lines.find((l) => accountIds.has(l.ledgerAccountId))?.ledgerAccountId;
  if (filters.accountId && moneyAccount !== filters.accountId) return false;

  const categoryLine = event.lines.find((l) => !accountIds.has(l.ledgerAccountId));
  if (filters.categoryId && categoryLine?.ledgerAccountId !== filters.categoryId) return false;
  if (filters.uncategorized && categoryLine && snapshot.categories.some((c) => c.id === categoryLine.ledgerAccountId)) return false;

  if (filters.hasReceipt) {
    const n = event.notes ?? '';
    if (!n.startsWith('receipt:') && !n.startsWith('http')) return false;
  }

  const magnitude = row.amount < 0n ? -row.amount : row.amount;
  if (filters.amountMin !== undefined && magnitude < filters.amountMin) return false;
  if (filters.amountMax !== undefined && magnitude > filters.amountMax) return false;

  return true;
}

export type FilterChip = { key: keyof TxFilters | 'uncategorized' | 'hasReceipt'; label: string };

export function filterChips(filters: TxFilters, snapshot: Snapshot): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      key: 'dateFrom',
      label: t('tx.filter.date', { from: filters.dateFrom ?? t('common.notSet'), to: filters.dateTo ?? t('common.notSet') }),
    });
  }
  if (filters.accountId) {
    chips.push({ key: 'accountId', label: snapshot.accounts.find((a) => a.id === filters.accountId)?.name ?? '' });
  }
  if (filters.categoryId) {
    chips.push({ key: 'categoryId', label: snapshot.categories.find((c) => c.id === filters.categoryId)?.name ?? '' });
  }
  if (filters.payeeId) {
    chips.push({ key: 'payeeId', label: snapshot.payees.find((p) => p.id === filters.payeeId)?.name ?? '' });
  }
  if (filters.type) {
    chips.push({ key: 'type', label: t(`add.kind.${filters.type}` as 'add.kind.expense') });
  }
  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    chips.push({ key: 'amountMin', label: t('tx.filter.amount') });
  }
  if (filters.uncategorized) {
    chips.push({ key: 'uncategorized', label: t('tx.filter.uncategorized') });
  }
  if (filters.hasReceipt) {
    chips.push({ key: 'hasReceipt', label: t('tx.filter.hasReceipt') });
  }
  return chips;
}

export function removeChip(filters: TxFilters, key: FilterChip['key']): TxFilters {
  const next = { ...filters };
  if (key === 'dateFrom') {
    delete next.dateFrom;
    delete next.dateTo;
  } else if (key === 'amountMin') {
    delete next.amountMin;
    delete next.amountMax;
  } else if (key === 'uncategorized') {
    delete next.uncategorized;
  } else if (key === 'hasReceipt') {
    delete next.hasReceipt;
  } else {
    delete next[key];
  }
  return next;
}

export function countActive(filters: TxFilters): number {
  let n = 0;
  if (filters.dateFrom || filters.dateTo) n++;
  if (filters.accountId) n++;
  if (filters.categoryId) n++;
  if (filters.payeeId) n++;
  if (filters.type) n++;
  if (filters.amountMin !== undefined || filters.amountMax !== undefined) n++;
  if (filters.uncategorized) n++;
  if (filters.hasReceipt) n++;
  return n;
}

export type DatePreset = 'thisMonth' | 'lastMonth' | 'last30';

export function applyDatePreset(preset: DatePreset, today: string): Pick<TxFilters, 'dateFrom' | 'dateTo'> {
  const [y, m] = today.split('-').map(Number) as [number, number];
  if (preset === 'thisMonth') {
    const from = `${today.slice(0, 7)}-01`;
    const last = new Date(y, m, 0).getDate();
    return { dateFrom: from, dateTo: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}` };
  }
  if (preset === 'lastMonth') {
    const d = new Date(y, m - 2, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { dateFrom: `${ym}-01`, dateTo: `${ym}-${String(last).padStart(2, '0')}` };
  }
  const from = addDays(today, -30);
  return { dateFrom: from, dateTo: today };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
