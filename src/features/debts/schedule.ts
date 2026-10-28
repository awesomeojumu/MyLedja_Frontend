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

export function debtSchedulePreview(input: {
  count: number;
  amountMinor: bigint;
  every: 'week' | 'month';
  firstDue: string;
}): DebtInstallment[] {
  const rows: DebtInstallment[] = [];
  for (let i = 0; i < input.count; i++) {
    const dueDate = input.every === 'week' ? addDays(input.firstDue, i * 7) : addMonths(input.firstDue, i);
    rows.push({ dueDate, amountMinor: input.amountMinor, status: 'upcoming' });
  }
  return rows;
}

function paymentCoversInstallment(payments: { date: string; amountMinor: bigint }[], inst: DebtInstallment): boolean {
  return payments.some((p) => p.date === inst.dueDate && p.amountMinor === inst.amountMinor);
}

/** Instalments from saved schedule with paid/due markers (P16-04). */
export function debtScheduleRows(debt: PersonDebt, snapshot: Snapshot, onDate: string): DebtInstallment[] {
  if (!debt.scheduleFirstDue || !debt.scheduleAmountMinor || !debt.scheduleInstallmentCount || !debt.scheduleEvery) return [];
  const preview = debtSchedulePreview({
    count: debt.scheduleInstallmentCount,
    amountMinor: BigInt(debt.scheduleAmountMinor),
    every: debt.scheduleEvery,
    firstDue: debt.scheduleFirstDue,
  });
  const payments = snapshot.debtEntries
    .filter((e) => e.debtId === debt.id && e.kind === 'payment')
    .map((e) => ({ date: e.date, amountMinor: BigInt(e.amountMinor) }));
  return preview.map((inst) => {
    if (paymentCoversInstallment(payments, inst)) return { ...inst, status: 'paid' as const };
    if (inst.dueDate < onDate) return { ...inst, status: 'overdue' as const };
    if (inst.dueDate === onDate) return { ...inst, status: 'due' as const };
    return inst;
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

export function reminderMessage(debt: PersonDebt, balance: bigint, next: DebtInstallment | null): string {
  if (next) {
    return t('debts.reminderWithDue', { name: debt.name, amount: formatNaira(next.amountMinor), date: formatDay(next.dueDate) });
  }
  return t('debts.reminderGeneric', { name: debt.name, balance: formatNaira(balance) });
}
