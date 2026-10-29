import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import type { EventType } from '@/ledger';

import type { Row } from './helpers';
import { parseReceipt } from './receiptMeta';
import { parseTags } from './tags';

export type TxStatusFilter = 'posted' | 'pending' | 'waiting';

export type TxFilters = {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  categoryId?: string;
  payeeId?: string;
  tag?: string;
  type?: EventType;
  status?: TxStatusFilter;
  amountMin?: bigint;
  amountMax?: bigint;
  uncategorized?: boolean;
  hasReceipt?: boolean;
  edited?: boolean;
};

export function emptyFilters(): TxFilters {
  return {};
}

/** URL params for the Transactions page's filters, so other pages can open "the transactions behind" a figure. */
export type FilterParams = { from?: string; to?: string; month?: string; account?: string; category?: string; payee?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Filters from the page's URL (P20-03, P06-09). Anything unreadable is left out. */
export function filtersFromParams(p: FilterParams): TxFilters {
  const out: TxFilters = {};
  if (p.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)) {
    const [y, m] = p.month.split('-').map(Number) as [number, number];
    out.dateFrom = `${p.month}-01`;
    out.dateTo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }
  if (p.from && DAY.test(p.from)) out.dateFrom = p.from;
  if (p.to && DAY.test(p.to)) out.dateTo = p.to;
  if (p.account) out.accountId = p.account;
  if (p.category) out.categoryId = p.category;
  if (p.payee) out.payeeId = p.payee;
  return out;
}

export function applyFilters(row: Row, filters: TxFilters, snapshot: Snapshot): boolean {
  const { event } = row;
  if (filters.dateFrom && event.date < filters.dateFrom) return false;
  if (filters.dateTo && event.date > filters.dateTo) return false;
  if (filters.type && event.type !== filters.type) return false;
  if (filters.payeeId && event.payeeId !== filters.payeeId) return false;

  if (filters.tag) {
    const tags = parseTags(event.notes);
    if (!tags.map((x) => x.toLowerCase()).includes(filters.tag.toLowerCase())) return false;
  }

  if (filters.status === 'waiting' && !row.waiting) return false;
  if (filters.status === 'posted' && (row.waiting || event.status !== 'posted')) return false;
  if (filters.status === 'pending' && event.status === 'posted' && !row.waiting) return false;

  if (filters.edited && !event.correctionOf) return false;

  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const moneyAccount = event.lines.find((l) => accountIds.has(l.ledgerAccountId))?.ledgerAccountId;
  if (filters.accountId && moneyAccount !== filters.accountId) return false;

  const categoryLine = event.lines.find((l) => !accountIds.has(l.ledgerAccountId));
  if (filters.categoryId && categoryLine?.ledgerAccountId !== filters.categoryId) return false;
  if (filters.uncategorized && categoryLine && snapshot.categories.some((c) => c.id === categoryLine.ledgerAccountId)) return false;

  if (filters.hasReceipt && !parseReceipt(event.notes) && !(event.notes ?? '').startsWith('http')) return false;

  const magnitude = row.amount < 0n ? -row.amount : row.amount;
  if (filters.amountMin !== undefined && magnitude < filters.amountMin) return false;
  if (filters.amountMax !== undefined && magnitude > filters.amountMax) return false;

  return true;
}

export type FilterChip = {
  key: keyof TxFilters | 'uncategorized' | 'hasReceipt' | 'edited' | 'tag' | 'status';
  label: string;
};

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
  if (filters.tag) {
    chips.push({ key: 'tag', label: filters.tag });
  }
  if (filters.type) {
    chips.push({ key: 'type', label: t(`panel.type.${filters.type}` as 'panel.type.expense') });
  }
  if (filters.status) {
    chips.push({ key: 'status', label: t(`tx.filter.status.${filters.status}` as 'tx.filter.status.posted') });
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
  if (filters.edited) {
    chips.push({ key: 'edited', label: t('tx.filter.edited') });
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
  } else if (key === 'edited') {
    delete next.edited;
  } else if (key === 'tag') {
    delete next.tag;
  } else if (key === 'status') {
    delete next.status;
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
  if (filters.tag) n++;
  if (filters.type) n++;
  if (filters.status) n++;
  if (filters.amountMin !== undefined || filters.amountMax !== undefined) n++;
  if (filters.uncategorized) n++;
  if (filters.hasReceipt) n++;
  if (filters.edited) n++;
  return n;
}

export type DatePreset = 'thisMonth' | 'lastMonth' | 'last30' | 'last3Months' | 'thisYear' | 'lastYear';

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
  if (preset === 'last3Months') {
    const d = new Date(y, m - 3, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { dateFrom: `${ym}-01`, dateTo: today };
  }
  if (preset === 'thisYear') {
    return { dateFrom: `${y}-01-01`, dateTo: today };
  }
  if (preset === 'lastYear') {
    return { dateFrom: `${y - 1}-01-01`, dateTo: `${y - 1}-12-31` };
  }
  const from = addDays(today, -30);
  return { dateFrom: from, dateTo: today };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** URL params for PU-19 / TB-13 (filters live in the address). */
export function filtersToParams(filters: TxFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.dateFrom) out.from = filters.dateFrom;
  if (filters.dateTo) out.to = filters.dateTo;
  if (filters.accountId) out.account = filters.accountId;
  if (filters.categoryId) out.category = filters.categoryId;
  if (filters.payeeId) out.payee = filters.payeeId;
  if (filters.tag) out.tag = filters.tag;
  if (filters.type) out.type = filters.type;
  if (filters.status) out.status = filters.status;
  if (filters.amountMin !== undefined) out.min = filters.amountMin.toString();
  if (filters.amountMax !== undefined) out.max = filters.amountMax.toString();
  if (filters.uncategorized) out.uncategorized = '1';
  if (filters.hasReceipt) out.hasReceipt = '1';
  if (filters.edited) out.edited = '1';
  return out;
}

export function filtersFromParams(params: Record<string, string | undefined>): TxFilters {
  const filters: TxFilters = {};
  if (params.from) filters.dateFrom = params.from;
  if (params.to) filters.dateTo = params.to;
  if (params.account) filters.accountId = params.account;
  if (params.category) filters.categoryId = params.category;
  if (params.payee) filters.payeeId = params.payee;
  if (params.tag) filters.tag = params.tag;
  if (params.type) filters.type = params.type as EventType;
  if (params.status === 'posted' || params.status === 'pending' || params.status === 'waiting') filters.status = params.status;
  if (params.min && /^\d+$/.test(params.min)) filters.amountMin = BigInt(params.min);
  if (params.max && /^\d+$/.test(params.max)) filters.amountMax = BigInt(params.max);
  if (params.uncategorized === '1') filters.uncategorized = true;
  if (params.hasReceipt === '1') filters.hasReceipt = true;
  if (params.edited === '1') filters.edited = true;
  return filters;
}

export const FILTER_PARAM_KEYS = [
  'from',
  'to',
  'account',
  'category',
  'payee',
  'tag',
  'type',
  'status',
  'min',
  'max',
  'uncategorized',
  'hasReceipt',
  'edited',
] as const;

export function clearFilterParams(): Record<string, undefined> {
  return Object.fromEntries(FILTER_PARAM_KEYS.map((k) => [k, undefined])) as Record<string, undefined>;
}
