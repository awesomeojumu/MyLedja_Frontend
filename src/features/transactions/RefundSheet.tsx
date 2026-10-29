import { useState } from 'react';

import { Amount, AmountInput, Button, DatePicker, Footer, InlineError, Select, Sheet, Text, useToast } from '@/design/components';
import type { TxEvent } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { ledgerMessage, today } from './helpers';

/** Popup #22 — refund against purchase (addendum PU-22). */
export function RefundSheet({
  event,
  purchaseAmount,
  left,
  onClose,
}: {
  event: TxEvent;
  purchaseAmount: bigint;
  left: bigint;
  onClose: () => void;
}) {
  const { repo, snapshot } = useWorkspace();
  const toast = useToast();
  const accountIds = new Set((snapshot?.accounts ?? []).map((a) => a.id));
  const payee = snapshot?.payees.find((p) => p.id === event.payeeId)?.name;
  const already = purchaseAmount < 0n ? -purchaseAmount - left : purchaseAmount - left;
  const absPurchase = purchaseAmount < 0n ? -purchaseAmount : purchaseAmount;
  const [text, setText] = useState(formatNaira(left).replace('₦', '').replace(/,/g, ''));
  const [minor, setMinor] = useState<bigint | null>(left);
  const [accountId, setAccountId] = useState<string | null>(event.lines.find((l) => accountIds.has(l.ledgerAccountId))?.ledgerAccountId ?? null);
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const too = minor !== null && minor > left;
  const beforeOriginal = date < event.date;
  const valid = minor !== null && minor > 0n && !!accountId && !too && !beforeOriginal;

  const save = async () => {
    if (!valid || !accountId || minor === null || busy) return;
    setBusy(true);
    const r = await repo.addRefund(event.id, { accountId, amount: minor, date });
    setBusy(false);
    if (!r.ok) return setError(r.error === 'refund_too_large' ? t('ledger.error.refund_too_large', { amount: formatNaira(left) }) : ledgerMessage(r.error));
    toast.show(t('panel.refundSaved'));
    onClose();
  };

  return (
    <Sheet
      visible
      testID="refund-sheet"
      title={t('panel.refundTitle')}
      onClose={onClose}
      width={420}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="refund-save" label={t('panel.saveRefund')} disabled={!valid || busy} onPress={() => void save()} />
        </Footer>
      }
    >
      <Text tone="textSecondary" testID="refund-original-summary">
        {t('panel.refundSummary', {
          payee: payee ?? t('panel.refundUntitled'),
          date: event.date,
          amount: formatNaira(absPurchase),
          refunded: formatNaira(already < 0n ? 0n : already),
        })}
      </Text>
      <Text tone="textSecondary">{t('panel.refundCaption')}</Text>
      <AmountInput
        testID="refund-amount"
        label={t('panel.refundAmount')}
        value={text}
        onChange={(v, m) => {
          setText(v);
          setMinor(m);
        }}
      />
      {too ? <InlineError testID="refund-error" message={t('ledger.error.refund_too_large', { amount: formatNaira(absPurchase) })} /> : null}
      <Select
        testID="refund-account"
        label={t('panel.refundInto')}
        options={(snapshot?.accounts ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))}
        value={accountId}
        onChange={setAccountId}
      />
      <DatePicker testID="refund-date" label={t('add.date')} value={date} onChange={setDate} />
      {beforeOriginal ? <InlineError testID="refund-date-error" message={t('panel.refundDateBefore')} /> : null}
      {error ? <InlineError message={error} /> : null}
      <Amount minor={left} />
    </Sheet>
  );
}
