import type { PersonDebt } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { formatDay } from '@/design/components';

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const [y, m, day] = iso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const d = Math.min(day, last);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export type DebtInstallment = {
  dueDate: string;
  amountMinor: bigint;
  status: 'paid' | 'due' | 'overdue' | 'upcoming';
};

/** Original principal from the opening lend/borrow entry. */
export function debtOriginalAmount(debtId: string, snapshot: Snapshot): bigint {
  const open = snapshot.debtEntries.find((e) => e.debtId === debtId && (e.kind === 'lend' || e.kind === 'borrow'));
  return open ? BigInt(open.amountMinor) : 0n;
}

export function debtProgress(debtId: string, snapshot: Snapshot, balance: bigint): number {
  const original = debtOriginalAmount(debtId, snapshot);
  if (original <= 0n) return 0;
  const paid = original > balance ? original - balance : 0n;
  return Number(paid) / Number(original);
}

/**
 * Equal-split instalment amounts with the last absorbing remainder (TECH-SPEC 6.5 / PU-36).
 * When `preferred` is set and would overshoot `totalMinor`, falls back to equal split of the total.
 */
export function scheduleAmounts(count: number, totalMinor: bigint, preferred?: bigint): bigint[] {
  const n = Math.max(1, Math.min(120, count));
  if (totalMinor <= 0n) return Array.from({ length: n }, () => 0n);
  if (preferred !== undefined && preferred > 0n && preferred * BigInt(n) <= totalMinor) {
    const amounts = Array.from({ length: n }, () => preferred);
    const used = preferred * BigInt(n - 1);
    amounts[n - 1] = totalMinor - used;
    return amounts;
  }
  const base = totalMinor / BigInt(n);
  const amounts = Array.from({ length: n }, () => base);
  const used = base * BigInt(n);
  amounts[n - 1] = amounts[n - 1]! + (totalMinor - used);
  return amounts;
}

export function debtSchedulePreview(input: {
  count: number;
  amountMinor: bigint;
  every: 'week' | 'month';
  firstDue: string;
  /** When set, split this total across instalments; last row absorbs remainder (PU-36). */
  totalMinor?: bigint;
}): DebtInstallment[] {
  const amounts =
    input.totalMinor !== undefined && input.totalMinor > 0n
      ? scheduleAmounts(input.count, input.totalMinor, input.amountMinor)
      : Array.from({ length: input.count }, () => input.amountMinor);
  const rows: DebtInstallment[] = [];
  for (let i = 0; i < amounts.length; i++) {
    const dueDate = input.every === 'week' ? addDays(input.firstDue, i * 7) : addMonths(input.firstDue, i);
    rows.push({ dueDate, amountMinor: amounts[i]!, status: 'upcoming' });
  }
  return rows;
}

/** Interest due to date for a fixed or %/month debt (TECH-SPEC 6.9 default split). */
export function interestDueToDate(debt: PersonDebt, outstanding: bigint, onDate: string): bigint {
  const terms = debt.interest;
  if (!terms || terms.kind === 'none' || outstanding <= 0n) return 0n;
  if (terms.kind === 'fixed') return BigInt(terms.amountMinor);
  // percent_month: one month's interest on outstanding (simple default until accrual tracking lands).
  const pct = Math.max(0, Math.min(100, terms.percent));
  void onDate;
  return (outstanding * BigInt(Math.round(pct * 100))) / 10_000n;
}

export function debtIsOverdue(debt: PersonDebt, snapshot: Snapshot, onDate: string): boolean {
  const next = nextInstallment(debt, snapshot, onDate);
  if (next) return next.status === 'overdue';
  if (debt.nextDueDate) return debt.nextDueDate < onDate && debt.status === 'open';
  return false;
}

function paymentCoversInstallment(payments: { date: string; amountMinor: bigint }[], inst: DebtInstallment): boolean {
  return payments.some((p) => p.date === inst.dueDate && p.amountMinor === inst.amountMinor);
}

/** Instalments from saved schedule with paid/due markers (P16-04 / PU-36). */
export function debtScheduleRows(debt: PersonDebt, snapshot: Snapshot, onDate: string, totalMinor?: bigint): DebtInstallment[] {
  if (!debt.scheduleFirstDue || !debt.scheduleAmountMinor || !debt.scheduleInstallmentCount || !debt.scheduleEvery) return [];
  const original = totalMinor ?? debtOriginalAmount(debt.id, snapshot);
  const preview = debtSchedulePreview({
    count: debt.scheduleInstallmentCount,
    amountMinor: BigInt(debt.scheduleAmountMinor),
    every: debt.scheduleEvery,
    firstDue: debt.scheduleFirstDue,
    totalMinor: original > 0n ? original : undefined,
  });
  const payments = snapshot.debtEntries
    .filter((e) => e.debtId === debt.id && e.kind === 'payment')
    .map((e) => ({ date: e.date, amountMinor: BigInt(e.amountMinor) }));
  return preview.map((inst) => {
    if (paymentCoversInstallment(payments, inst)) return { ...inst, status: 'paid' as const };
    if (inst.dueDate < onDate) return { ...inst, status: 'overdue' as const };
    if (inst.dueDate === onDate) return { ...inst, status: 'due' as const };
    return { ...inst, status: 'upcoming' as const };
  });
}

export function nextInstallment(debt: PersonDebt, snapshot: Snapshot, onDate: string): DebtInstallment | null {
  const rows = debtScheduleRows(debt, snapshot, onDate);
  return rows.find((r) => r.status !== 'paid') ?? null;
}

export function payoffByDate(debt: PersonDebt, snapshot: Snapshot): string | null {
  const rows = debtScheduleRows(debt, snapshot, '9999-12-31');
  const last = rows.filter((r) => r.status !== 'paid').at(-1) ?? rows.at(-1);
  return last?.dueDate ?? null;
}

export function timelineKindLabel(kind: string): string {
  switch (kind) {
    case 'lend':
      return t('debts.timelineLend');
    case 'borrow':
      return t('debts.timelineBorrow');
    case 'payment':
      return t('debts.timelinePayment');
    case 'write_off':
      return t('debts.timelineWriteOff');
    default:
      return kind;
  }
}

export function reminderMessage(
  debt: PersonDebt,
  balance: bigint,
  next: DebtInstallment | null,
  opts?: { omitAmount?: boolean },
): string {
  if (opts?.omitAmount) {
    if (next) return t('debts.reminderWithDueNoAmount', { name: debt.name, date: formatDay(next.dueDate) });
    return t('debts.reminderGenericNoAmount', { name: debt.name });
  }
  if (next) {
    return t('debts.reminderWithDue', { name: debt.name, amount: formatNaira(next.amountMinor), date: formatDay(next.dueDate) });
  }
  return t('debts.reminderGeneric', { name: debt.name, balance: formatNaira(balance) });
}

/** Interest portion to show on an instalment preview row when the debt has interest terms (PU-36). */
export function instalmentInterestPreview(debt: PersonDebt, principalMinor: bigint): bigint {
  const terms = debt.interest;
  if (!terms || terms.kind === 'none' || principalMinor <= 0n) return 0n;
  if (terms.kind === 'fixed') return BigInt(terms.amountMinor);
  const pct = Math.max(0, Math.min(100, terms.percent));
  return (principalMinor * BigInt(Math.round(pct * 100))) / 10_000n;
}
