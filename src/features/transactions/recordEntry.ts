import type { LedgerErrorCode } from '../../ledger/types';
import type { WorkspaceRepository } from '../../data/workspace/repository';
import { t } from '../../i18n';

/**
 * Everything the quick add sheets can record, each as exactly one movement of money.
 *
 * Saving into a goal or a savings account and buying an investment are moves between your own accounts, so they
 * never count as spending; paying back a debt reduces what you owe. Before this, the app posted an expense AND
 * the move, so the money left the account twice.
 */
export type QuickEntry =
  | {
      flow: 'expense';
      accountId: string;
      categoryId: string;
      amount: bigint;
      date: string;
      payee?: string;
      /** Subcategory from Settings › Categories; kept in the notes. */
      detail?: string;
    }
  | { flow: 'income'; accountId: string; categoryId: string; amount: bigint; date: string; payee?: string; detail?: string }
  /** Into a goal: earmarks the money, moving it to the goal's account first when it starts elsewhere. */
  | { flow: 'goal'; fromAccountId: string; goalId: string; amount: bigint; date: string }
  /** Into one of your savings accounts: a transfer. */
  | { flow: 'saveTransfer'; fromAccountId: string; toAccountId: string; amount: bigint; date: string }
  /** Buys units of a holding with cash from an account. */
  | { flow: 'invest'; fromAccountId: string; holdingId: string; amount: bigint; units: string; date: string }
  /** Pays back money you owe, or takes in money someone owed you. */
  | { flow: 'debt'; accountId: string; debtId: string; amount: bigint; date: string };

export type EntryResult = { ok: true } | { ok: false; message: string };

const fail = (error: LedgerErrorCode | string): EntryResult => {
  const key = `ledger.error.${error}`;
  const text = t(key as never);
  return { ok: false, message: text === key || !text ? t('quick.error.generic') : text };
};

/** Splits an amount across units; the price per unit is rounded down to the kobo, fees take nothing. */
export function pricePerUnit(amount: bigint, units: string): bigint | null {
  const n = Number(units);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Units may be fractional (fund units, grams); work in millionths to keep the maths in whole numbers.
  const micro = BigInt(Math.round(n * 1_000_000));
  if (micro <= 0n) return null;
  return (amount * 1_000_000n) / micro;
}

export async function recordEntry(repo: WorkspaceRepository, entry: QuickEntry): Promise<EntryResult> {
  if (entry.amount <= 0n) return fail('not_positive');
  try {
    switch (entry.flow) {
      case 'expense': {
        const res = await repo.addTransaction({
          kind: 'expense',
          accountId: entry.accountId,
          parts: [{ amount: entry.amount, categoryId: entry.categoryId }],
          date: entry.date,
          payeeName: entry.payee?.trim() || undefined,
          notes: entry.detail || undefined,
        });
        return res.ok ? { ok: true } : fail(res.error);
      }
      case 'income': {
        const res = await repo.addTransaction({
          kind: 'income',
          accountId: entry.accountId,
          categoryId: entry.categoryId,
          amount: entry.amount,
          date: entry.date,
          payeeName: entry.payee?.trim() || undefined,
          notes: entry.detail || undefined,
        });
        return res.ok ? { ok: true } : fail(res.error);
      }
      case 'goal': {
        const res = await repo.allocateToGoal(entry.goalId, {
          amount: entry.amount,
          fromAccountId: entry.fromAccountId,
          date: entry.date,
        });
        return res.ok ? { ok: true } : fail(res.error);
      }
      case 'saveTransfer': {
        if (entry.fromAccountId === entry.toAccountId) return fail('transfer_accounts');
        const res = await repo.addTransaction({
          kind: 'transfer',
          fromId: entry.fromAccountId,
          toId: entry.toAccountId,
          amount: entry.amount,
          date: entry.date,
        });
        return res.ok ? { ok: true } : fail(res.error);
      }
      case 'invest': {
        const price = pricePerUnit(entry.amount, entry.units);
        if (price === null || price <= 0n) return fail('not_positive');
        const res = await repo.buyHolding({
          holdingId: entry.holdingId,
          units: entry.units,
          pricePerUnit: price,
          cashAccountId: entry.fromAccountId,
          date: entry.date,
        });
        return res.ok ? { ok: true } : fail(res.error);
      }
      case 'debt': {
        const res = await repo.recordDebtPayment(entry.debtId, {
          accountId: entry.accountId,
          amount: entry.amount,
          date: entry.date,
          overpayment: 'credit',
        });
        return res.ok ? { ok: true } : fail(res.error);
      }
    }
  } catch (err) {
    console.warn('Could not record entry', err);
    return { ok: false, message: t('quick.error.generic') };
  }
}
