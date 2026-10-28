import { useState } from 'react';

import { Amount, AmountInput, Button, DatePicker, InlineError, Select, Sheet, Text, useToast } from '@/design/components';
import type { TxEvent } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { ledgerMessage, today } from './helpers';

/** Popup #22 — refund against purchase (DESIGN page 11). */
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
  const [text, setText] = useState('');
  const [minor, setMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState<string | null>(event.lines.find((l) => accountIds.has(l.ledgerAccountId))?.ledgerAccountId ?? null);
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const too = minor !== null && minor > left;

  const save = async () => {
    if (minor === null || !accountId) return;
    const r = await repo.addRefund(event.id, { accountId, amount: minor, date });
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
      footer={
        <Button testID="refund-save" label={t('panel.saveRefund')} disabled={minor === null || minor <= 0n || too} onPress={() => void save()} />
      }
    >
      <Text tone="textSecondary">{t('panel.refundOriginal')}</Text>
      <Amount minor={purchaseAmount < 0n ? -purchaseAmount : purchaseAmount} />
      <Text tone="textSecondary">
        {t('panel.refundLeft', { amount: formatNaira(left) })}
      </Text>
      <AmountInput
        testID="refund-amount"
        label={t('panel.refundAmount')}
        value={text}
        onChange={(v, m) => {
          setText(v);
          setMinor(m);
        }}
      />
      {too ? <InlineError testID="refund-error" message={t('ledger.error.refund_too_large', { amount: formatNaira(left) })} /> : null}
      <Select
        label={t('panel.refundInto')}
        options={(snapshot?.accounts ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))}
        value={accountId}
        onChange={setAccountId}
      />
      <DatePicker label={t('add.date')} value={date} onChange={setDate} />
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}
