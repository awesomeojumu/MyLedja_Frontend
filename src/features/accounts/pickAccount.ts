import type { Account } from '../../data/workspace/model';
import { purposeOf, isSpendingAccount, type AccountPurpose } from './purpose';

/** The account to use when a screen has no account picker: one with the given purpose, else the first everyday one. */
export function pickAccount(accounts: Account[], prefer?: AccountPurpose): Account | undefined {
  const live = accounts.filter((a) => !a.archived);
  return (
    (prefer ? live.find((a) => purposeOf(a) === prefer) : undefined) ??
    live.find((a) => purposeOf(a) === 'operating' && isSpendingAccount(a)) ??
    live.find(isSpendingAccount) ??
    live[0]
  );
}
