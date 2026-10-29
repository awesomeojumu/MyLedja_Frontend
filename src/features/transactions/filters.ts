import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import type { EventType } from '@/ledger';

import type { Row } from './helpers';
import { parseReceipt } from './receiptMeta';
import { parseTags } from './tags';

export type TxStatusFilter = 'posted' | 'pending' | 'waiting';

/** Real event types plus connection filters (debt/goal/investment). */
export type TxTypeFilter = EventType | 'debt' | 'goal' | 'investment';

export type TxFilters = {
  dateFrom?: string;
  dateTo?: string;
  /** @deprecated prefer accountIds */
  accountId?: string;
  /** @deprecated prefer categoryIds */
  categoryId?: string;
  /** @deprecated prefer payeeIds */
  payeeId?: string;
  /** @deprecated prefer tags */
  tag?: string;
  accountIds?: string[];
  categoryIds?: string[];
  payeeIds?: string[];
  tags?: string[];
  type?: TxTypeFilter;
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

function accountIdList(filters: TxFilters): string[] {
  if (filters.accountIds?.length) return filters.accountIds;
  return filters.accountId ? [filters.accountId] : [];
}

function categoryIdList(filters: TxFilters): string[] {
  if (filters.categoryIds?.length) return filters.categoryIds;
  return filters.categoryId ? [filters.categoryId] : [];
}

function payeeIdList(filters: TxFilters): string[] {
  if (filters.payeeIds?.length) return filters.payeeIds;
  return filters.payeeId ? [filters.payeeId] : [];
}

function tagList(filters: TxFilters): string[] {
  if (filters.tags?.length) return filters.tags;
  return filters.tag ? [filters.tag] : [];
}

export function applyFilters(row: Row, filters: TxFilters, snapshot: Snapshot): boolean {
  const { event } = row;
  if (filters.dateFrom && event.date < filters.dateFrom) return false;
  if (filters.dateTo && event.date > filters.dateTo) return false;

  if (filters.type === 'debt') {
    if (!event.debtId) return false;
  } else if (filters.type === 'goal') {
    if (!event.goalId) return false;
  } else if (filters.type === 'investment') {
    if (event.type !== 'investment_buy' && event.type !== 'investment_sell') return false;
  } else if (filters.type && event.type !== filters.type) {
    return false;
  }

  const payees = payeeIdList(filters);
  if (payees.length && (!event.payeeId || !payees.includes(event.payeeId))) return false;

  const wantTags = tagList(filters);
  if (wantTags.length) {
    const tags = parseTags(event.notes).map((x) => x.toLowerCase());
    if (!wantTags.every((tag) => tags.includes(tag.toLowerCase()))) return false;
  }

  if (filters.status === 'waiting' && !row.waiting) return false;
  if (filters.status === 'posted' && (row.waiting || event.status !== 'posted')) return false;
  if (filters.status === 'pending' && event.status === 'posted' && !row.waiting) return false;

  if (filters.edited && !event.correctionOf) return false;

  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const moneyAccount = event.lines.find((l) => accountIds.has(l.ledgerAccountId))?.ledgerAccountId;
  const accounts = accountIdList(filters);
  if (accounts.length && (!moneyAccount || !accounts.includes(moneyAccount))) return false;

  const categoryLine = event.lines.find((l) => !accountIds.has(l.ledgerAccountId));
  const categories = categoryIdList(filters);
  if (categories.length && (!categoryLine || !categories.includes(categoryLine.ledgerAccountId))) return false;
  if (filters.uncategorized && categoryLine && snapshot.categories.some((c) => c.id === categoryLine.ledgerAccountId)) return false;

  if (filters.hasReceipt && !parseReceipt(event.notes) && !(event.notes ?? '').startsWith('http')) return false;

  const magnitude = row.amount < 0n ? -row.amount : row.amount;
  if (filters.amountMin !== undefined && magnitude < filters.amountMin) return false;
  if (filters.amountMax !== undefined && magnitude > filters.amountMax) return false;

  return true;
}

export type FilterChip = {
  key: keyof TxFilters | 'uncategorized' | 'hasReceipt' | 'edited' | 'tag' | 'status' | 'accountIds' | 'categoryIds' | 'payeeIds' | 'tags';
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
  const accounts = accountIdList(filters);
  if (accounts.length === 1) {
    chips.push({ key: 'accountIds', label: snapshot.accounts.find((a) => a.id === accounts[0])?.name ?? '' });
  } else if (accounts.length > 1) {
    chips.push({ key: 'accountIds', label: t('tx.filter.accountsCount', { count: accounts.length }) });
  }
  const categories = categoryIdList(filters);
  if (categories.length === 1) {
    chips.push({ key: 'categoryIds', label: snapshot.categories.find((c) => c.id === categories[0])?.name ?? '' });
  } else if (categories.length > 1) {
    chips.push({ key: 'categoryIds', label: t('tx.filter.categoriesCount', { count: categories.length }) });
  }
  const payees = payeeIdList(filters);
  if (payees.length === 1) {
    chips.push({ key: 'payeeIds', label: snapshot.payees.find((p) => p.id === payees[0])?.name ?? '' });
  } else if (payees.length > 1) {
    chips.push({ key: 'payeeIds', label: t('tx.filter.payeesCount', { count: payees.length }) });
  }
  const tags = tagList(filters);
  if (tags.length === 1) {
    chips.push({ key: 'tags', label: tags[0]! });
  } else if (tags.length > 1) {
    chips.push({ key: 'tags', label: t('tx.filter.tagsCount', { count: tags.length }) });
  }
  if (filters.type) {
    chips.push({
      key: 'type',
      label:
        filters.type === 'debt' || filters.type === 'goal' || filters.type === 'investment'
          ? t(`tx.filter.type.${filters.type}` as 'tx.filter.type.debt')
          : t(`panel.type.${filters.type}` as 'panel.type.expense'),
    });
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
  } else if (key === 'tag' || key === 'tags') {
    delete next.tag;
    delete next.tags;
  } else if (key === 'status') {
    delete next.status;
  } else if (key === 'accountId' || key === 'accountIds') {
    delete next.accountId;
    delete next.accountIds;
  } else if (key === 'categoryId' || key === 'categoryIds') {
    delete next.categoryId;
    delete next.categoryIds;
  } else if (key === 'payeeId' || key === 'payeeIds') {
    delete next.payeeId;
    delete next.payeeIds;
  } else {
    delete next[key];
  }
  return next;
}

export function countActive(filters: TxFilters): number {
  let n = 0;
  if (filters.dateFrom || filters.dateTo) n++;
  if (accountIdList(filters).length) n++;
  if (categoryIdList(filters).length) n++;
  if (payeeIdList(filters).length) n++;
  if (tagList(filters).length) n++;
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

function csv(ids: string[] | undefined): string | undefined {
  return ids?.length ? ids.join(',') : undefined;
}

function fromCsv(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/** URL params for PU-19 / TB-13 (filters live in the address). */
export function filtersToParams(filters: TxFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.dateFrom) out.from = filters.dateFrom;
  if (filters.dateTo) out.to = filters.dateTo;
  const accounts = accountIdList(filters);
  const categories = categoryIdList(filters);
  const payees = payeeIdList(filters);
  const tags = tagList(filters);
  const account = csv(accounts);
  const category = csv(categories);
  const payee = csv(payees);
  const tag = csv(tags);
  if (account) out.account = account;
  if (category) out.category = category;
  if (payee) out.payee = payee;
  if (tag) out.tag = tag;
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
  const accounts = fromCsv(params.account);
  const categories = fromCsv(params.category);
  const payees = fromCsv(params.payee);
  const tags = fromCsv(params.tag);
  if (accounts) filters.accountIds = accounts;
  if (categories) filters.categoryIds = categories;
  if (payees) filters.payeeIds = payees;
  if (tags) filters.tags = tags;
  if (params.type) filters.type = params.type as TxTypeFilter;
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

export function toggleId(list: string[] | undefined, id: string): string[] | undefined {
  const cur = list ?? [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  return next.length ? next : undefined;
}
