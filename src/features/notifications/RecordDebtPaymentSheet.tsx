import type { Snapshot } from '@/data/workspace/repository';

import { DebtsPaymentSheet, type DebtPaymentSave } from '@/features/debts/DebtsPaymentSheet';

/**
 * Notification entry for PU-35 — same sheet as Debt detail (defaults, split, overpay, date, duplicate).
 */
export function RecordDebtPaymentSheet({
  max,
  snapshot,
  debtId,
  onClose,
  onSave,
}: {
  max: bigint;
  snapshot: Snapshot;
  debtId?: string;
  onClose: () => void;
  onSave: (input: DebtPaymentSave) => Promise<void>;
}) {
  const debt = debtId ? snapshot.debts.find((d) => d.id === debtId) : undefined;
  return <DebtsPaymentSheet debt={debt} max={max} snapshot={snapshot} onClose={onClose} onSave={onSave} />;
}
