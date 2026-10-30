import { ACCOUNT_KIND_INFO, type Account, type AccountKind } from '@/data/workspace/model';
import { t, type TextKey } from '@/i18n';

/** Figma Accounts groups (Phone / Accounts `3:1517`). Property / Other kept when present. */
export const REDESIGN_ACCOUNT_GROUPS = [
  'everyday',
  'savings',
  'creditLoans',
  'investments',
  'property',
  'other',
] as const;

export type RedesignAccountGroup = (typeof REDESIGN_ACCOUNT_GROUPS)[number];

const KIND_TO_REDESIGN_GROUP: Record<AccountKind, RedesignAccountGroup> = {
  bank: 'everyday',
  cash: 'everyday',
  wallet: 'everyday',
  savings: 'savings',
  card: 'creditLoans',
  loan: 'creditLoans',
  other_liability: 'creditLoans',
  investment: 'investments',
  fixed_deposit: 'investments',
  pension: 'investments',
  property: 'property',
  other_asset: 'other',
};

export function redesignGroupFor(kind: AccountKind): RedesignAccountGroup {
  return KIND_TO_REDESIGN_GROUP[kind];
}

export function redesignGroupLabel(group: RedesignAccountGroup): string {
  return t(`redesign.accounts.group.${group}` as TextKey);
}

export function sortRedesignRows<T extends { account: Account; balance: bigint }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.account.order - b.account.order || a.account.name.localeCompare(b.account.name));
}

export function isLiabilityKind(kind: AccountKind): boolean {
  return ACCOUNT_KIND_INFO[kind].ledger === 'liability';
}
