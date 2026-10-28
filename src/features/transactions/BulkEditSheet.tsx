import { useState } from 'react';

import { Button, Select, Sheet, Text } from '@/design/components';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';

type BulkField = 'category' | 'payee' | 'delete';

export function BulkEditSheet({
  snapshot,
  count,
  onClose,
  onApply,
}: {
  snapshot: Snapshot;
  count: number;
  onClose: () => void;
  onApply: (field: BulkField, value?: string) => Promise<void>;
}) {
  const [field, setField] = useState<BulkField>('category');
  const [value, setValue] = useState('');
  const categories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));
  const payees = snapshot.payees.map((p) => ({ value: p.id, label: p.name }));
  const options =
    field === 'category' ? categories : field === 'payee' ? payees : [{ value: 'delete', label: t('tx.delete') }];

  return (
    <Sheet
      visible
      title={t('tx.bulk.title')}
      onClose={onClose}
      testID="tx-bulk-sheet"
      footer={
        <Button
          testID="tx-bulk-apply"
          label={t('tx.bulk.apply')}
          disabled={field !== 'delete' && !value}
          onPress={() => void onApply(field, field === 'delete' ? undefined : value).then(onClose)}
        />
      }
    >
      <Text tone="textSecondary">{t('tx.bulk.body', { count })}</Text>
      <Select
        testID="tx-bulk-field"
        label={t('tx.bulk.field')}
        options={[
          { value: 'category', label: t('add.category') },
          { value: 'payee', label: t('add.payee') },
          { value: 'delete', label: t('tx.delete') },
        ]}
        value={field}
        onChange={(v) => {
          setField(v as BulkField);
          setValue('');
        }}
      />
      {field === 'delete' ? null : (
        <Select testID="tx-bulk-value" label={t('tx.bulk.value')} options={options} value={value} onChange={setValue} />
      )}
    </Sheet>
  );
}
