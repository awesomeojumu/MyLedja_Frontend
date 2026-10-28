import { t } from '@/i18n';

import type { LedgerAccount, LedgerKind, SystemAccount } from './types';

/** B1.1: the system accounts every workspace has, with their kinds (TECH-SPEC 6.1). */
export const SYSTEM_ACCOUNTS: Record<SystemAccount, LedgerKind> = {
  opening_balances: 'equity',
  adjustments: 'equity',
  revaluation: 'equity',
  fx_clearing: 'equity',
  interest_earned: 'income',
  interest_and_charges: 'expense',
  fees: 'expense',
  taxes: 'expense',
  written_off: 'loss',
  investment_gain_loss: 'income',
};

/** Seeding twice gives the same accounts: ids come from the system key. */
export function systemAccounts(workspaceId: string, currency = 'NGN'): LedgerAccount[] {
  return (Object.keys(SYSTEM_ACCOUNTS) as SystemAccount[]).map((key) => ({
    id: `${workspaceId}:${key}`,
    kind: SYSTEM_ACCOUNTS[key],
    name: t(`ledger.system.${key}`),
    currency,
    system: key,
  }));
}
