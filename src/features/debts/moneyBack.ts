import type { PersonDebt } from '@/data/workspace/model';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { formatNaira } from '@/money';

import { debtRows } from './helpers';

/** Mirrors BE MoneyBackSuggestion (TECH-SPEC 6.15 / B2.6). */
export type MoneyBackSuggestion = {
  id: string;
  debtId: string;
  direction: 'incoming' | 'outgoing';
  personName: string;
  outstanding: bigint;
  amount: bigint;
  date: string;
  accountId: string;
  payeeId?: string;
  /** Existing posted event when reviewing an import or typed income. */
  eventId?: string;
  reason: 'payee_match' | 'instalment_amount' | 'both';
};

export type MoneyBackChoice = 'money_back' | 'income';

function payeeMatchesDebt(snapshot: Snapshot, debt: PersonDebt, payeeId?: string, payeeName?: string): boolean {
  if (payeeId && debt.payeeId && payeeId === debt.payeeId) return true;
  const name = payeeName?.trim().toLowerCase();
  if (!name) return false;
  if (debt.name.trim().toLowerCase() === name) return true;
  if (!debt.payeeId) return false;
  const payee = snapshot.payees.find((p) => p.id === debt.payeeId);
  if (!payee) return false;
  if (payee.name.toLowerCase() === name) return true;
  return (payee.aliases ?? []).some((a) => a.toLowerCase() === name);
}

function nextInstalmentAmount(debt: PersonDebt): bigint | null {
  if (!debt.scheduleAmountMinor) return null;
  return BigInt(debt.scheduleAmountMinor);
}

/**
 * Suggest money-back when payee matches an open debt person or the amount equals their next instalment.
 * Never posts; caller must confirm (TECH-SPEC 6.15).
 */
export function suggestMoneyBack(
  snapshot: Snapshot,
  input: {
    amount: bigint;
    date: string;
    accountId: string;
    payeeId?: string;
    payeeName?: string;
    /** 'income' → they_owe_me; 'expense' → iOwe. */
    movement: 'income' | 'expense';
    eventId?: string;
  },
): MoneyBackSuggestion[] {
  if (input.amount <= 0n) return [];
  const wantDirection = input.movement === 'income' ? 'owedToMe' : 'iOwe';
  const open = debtRows(snapshot, wantDirection, input.date).filter((r) => r.debt.status === 'open' && r.balance > 0n);
  const out: MoneyBackSuggestion[] = [];
  for (const { debt, balance } of open) {
    let reason: MoneyBackSuggestion['reason'] | null = null;
    if (payeeMatchesDebt(snapshot, debt, input.payeeId, input.payeeName)) reason = 'payee_match';
    const instalment = nextInstalmentAmount(debt);
    if (instalment !== null && instalment === input.amount) {
      reason = reason === 'payee_match' ? 'both' : 'instalment_amount';
    }
    if (!reason) continue;
    out.push({
      id: `${debt.id}:${input.eventId ?? 'draft'}:${input.date}:${input.amount.toString()}`,
      debtId: debt.id,
      direction: wantDirection === 'owedToMe' ? 'incoming' : 'outgoing',
      personName: debt.name,
      outstanding: balance,
      amount: input.amount,
      date: input.date,
      accountId: input.accountId,
      payeeId: input.payeeId ?? debt.payeeId,
      eventId: input.eventId,
      reason,
    });
  }
  return out;
}

/** Imported income/expense events that may be money back and are not yet linked to a debt payment. */
export function listMoneyBackReview(snapshot: Snapshot, onDate?: string): MoneyBackSuggestion[] {
  const paidEventIds = new Set(snapshot.debtEntries.filter((e) => e.kind === 'payment').map((e) => e.eventId));
  const out: MoneyBackSuggestion[] = [];
  const seen = new Set<string>();
  for (const event of snapshot.events) {
    if (event.status !== 'posted' || !event.importId) continue;
    if (event.type !== 'income' && event.type !== 'expense') continue;
    if (paidEventIds.has(event.id)) continue;
    const cash = cashLine(event, snapshot);
    if (!cash) continue;
    const amount = cash.amount;
    if (amount <= 0n) continue;
    const accountId = cash.accountId;
    const payee = event.payeeId ? snapshot.payees.find((p) => p.id === event.payeeId) : undefined;
    const suggestions = suggestMoneyBack(snapshot, {
      amount,
      date: event.date,
      accountId,
      payeeId: event.payeeId,
      payeeName: payee?.name,
      movement: event.type === 'income' ? 'income' : 'expense',
      eventId: event.id,
    });
    for (const s of suggestions) {
      if (seen.has(s.id)) continue;
      if (onDate && s.date > onDate) continue;
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}

function cashLine(event: TxEvent, snapshot: Snapshot): { accountId: string; amount: bigint } | null {
  for (const l of event.lines) {
    const a = snapshot.chart.get(l.ledgerAccountId);
    if (!a || a.system) continue;
    if (a.kind !== 'asset' && a.kind !== 'liability') continue;
    const amount = l.amountMinor < 0n ? -l.amountMinor : l.amountMinor;
    return { accountId: l.ledgerAccountId, amount };
  }
  return null;
}

export function moneyBackPromptCopy(suggestion: MoneyBackSuggestion): {
  titleKey: 'debts.moneyBack.titleIncoming' | 'debts.moneyBack.titleOutgoing';
  titleVars: { name: string };
  bodyKey: 'debts.moneyBack.body';
  bodyVars: { amount: string; outstanding: string; name: string };
} {
  return {
    titleKey: suggestion.direction === 'incoming' ? 'debts.moneyBack.titleIncoming' : 'debts.moneyBack.titleOutgoing',
    titleVars: { name: suggestion.personName },
    bodyKey: 'debts.moneyBack.body',
    bodyVars: {
      amount: formatNaira(suggestion.amount),
      outstanding: formatNaira(suggestion.outstanding),
      name: suggestion.personName,
    },
  };
}
