import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { t } from '@/i18n';

export type ConnectedLine = { key: string; label: string; detail?: string };

/** DESIGN page 11 panel Connected block. */
export function connectedLines(snapshot: Snapshot, event: TxEvent): ConnectedLine[] {
  const out: ConnectedLine[] = [];
  if (event.refundOf) {
    const original = snapshot.events.find((e) => e.id === event.refundOf);
    out.push({ key: 'refund', label: t('panel.connectedRefund'), detail: original?.date });
  }
  if (event.goalId) {
    const goal = snapshot.goals.find((g) => g.id === event.goalId);
    if (goal) out.push({ key: 'goal', label: t('panel.connectedGoal'), detail: goal.name });
  }
  if (event.debtId) {
    const debt = snapshot.debts.find((d) => d.id === event.debtId);
    if (debt) out.push({ key: 'debt', label: t('panel.connectedDebt'), detail: debt.name });
  }
  if (event.recurringId) {
    const bill = snapshot.recurring.find((r) => r.id === event.recurringId);
    if (bill) out.push({ key: 'bill', label: t('panel.connectedBill'), detail: bill.name });
  }
  if (event.incomeStreamId) {
    const stream = snapshot.incomeStreams.find((s) => s.id === event.incomeStreamId);
    if (stream) out.push({ key: 'income', label: t('panel.connectedIncome'), detail: stream.name });
  }
  if (event.type === 'transfer') {
    out.push({ key: 'transfer', label: t('panel.connectedTransfer') });
  }
  return out;
}

export function rowIndicators(event: TxEvent): string[] {
  const marks: string[] = [];
  if (event.splitTotal) marks.push('split');
  if (event.refundOf) marks.push('refund');
  if (event.reconciledBy) marks.push('locked');
  if (event.notes?.startsWith('receipt:') || event.notes?.startsWith('http')) marks.push('receipt');
  if (event.recurringId) marks.push('recurring');
  return marks;
}
