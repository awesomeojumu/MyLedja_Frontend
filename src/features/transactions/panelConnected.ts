import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { t } from '@/i18n';

export type ConnectedLine = {
  key: string;
  label: string;
  detail?: string;
  href?: string;
  id?: string;
};

/** DESIGN page 11 panel Connected block. */
export function connectedLines(snapshot: Snapshot, event: TxEvent): ConnectedLine[] {
  const out: ConnectedLine[] = [];
  if (event.refundOf) {
    const original = snapshot.events.find((e) => e.id === event.refundOf);
    out.push({ key: 'refund', label: t('panel.connectedRefund'), detail: original?.date, id: event.refundOf });
  }
  if (event.goalId) {
    const goal = snapshot.goals.find((g) => g.id === event.goalId);
    if (goal) out.push({ key: 'goal', label: t('panel.connectedGoal'), detail: goal.name, href: '/goals', id: goal.id });
  }
  if (event.debtId) {
    const debt = snapshot.debts.find((d) => d.id === event.debtId);
    if (debt) out.push({ key: 'debt', label: t('panel.connectedDebt'), detail: debt.name, href: '/debts', id: debt.id });
  }
  if (event.recurringId) {
    const bill = snapshot.recurring.find((r) => r.id === event.recurringId);
    if (bill) out.push({ key: 'bill', label: t('panel.connectedBill'), detail: bill.name, href: '/plan', id: bill.id });
  }
  if (event.incomeStreamId) {
    const stream = snapshot.incomeStreams.find((s) => s.id === event.incomeStreamId);
    if (stream) out.push({ key: 'income', label: t('panel.connectedIncome'), detail: stream.name, href: '/income', id: stream.id });
  }
  if (event.type === 'transfer') {
    out.push({ key: 'transfer', label: t('panel.connectedTransfer') });
  }
  return out;
}

export type RowMark = 'split' | 'refund' | 'locked' | 'receipt' | 'recurring' | 'waiting';

const MARK_GLYPH: Record<RowMark, string> = {
  recurring: '↻',
  split: '⑂',
  refund: '↩',
  receipt: '📎',
  locked: '🔒',
  waiting: '🕓',
};

export function rowIndicators(event: TxEvent, waiting = false): RowMark[] {
  const marks: RowMark[] = [];
  if (event.splitTotal) marks.push('split');
  if (event.refundOf) marks.push('refund');
  if (event.reconciledBy) marks.push('locked');
  if (event.notes?.startsWith('receipt:') || event.notes?.startsWith('http') || event.notes?.includes('\nreceipt:')) marks.push('receipt');
  if (event.recurringId) marks.push('recurring');
  if (waiting) marks.push('waiting');
  return marks;
}

export function markGlyph(mark: RowMark): string {
  return MARK_GLYPH[mark];
}

export function marksDisplay(marks: RowMark[]): string {
  return marks.map(markGlyph).join('');
}
