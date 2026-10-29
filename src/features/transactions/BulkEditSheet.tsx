import { useState } from 'react';

import { Button, Confirm, Footer, Select, Sheet, Text, TextInput } from '@/design/components';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';

export type BulkField = 'category' | 'payee' | 'account' | 'tagAdd' | 'tagRemove' | 'delete';

/** Popup #20 — bulk edit (addendum PU-20). */
export function BulkEditSheet({
  snapshot,
  count,
  onClose,
  onApply,
  initialField = 'category',
}: {
  snapshot: Snapshot;
  count: number;
  onClose: () => void;
  onApply: (field: BulkField, value?: string) => Promise<void>;
  initialField?: BulkField;
}) {
  const [field, setField] = useState<BulkField>(initialField);
  const [value, setValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const categories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));
  const incomeCategories = snapshot.categories.filter((c) => c.kind === 'income').map((c) => ({ value: c.id, label: c.name }));
  const payees = snapshot.payees.map((p) => ({ value: p.id, label: p.name }));
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const needsValue = field !== 'delete';
  const options =
    field === 'category' ? [...categories, ...incomeCategories] : field === 'payee' ? payees : field === 'account' ? accounts : [];

  const apply = () => void onApply(field, field === 'delete' ? undefined : value).then(onClose);

  return (
    <>
      <Sheet
        visible
        title={t('tx.bulk.titleCount', { count })}
        onClose={onClose}
        testID="tx-bulk-sheet"
        width={420}
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
            <Button
              testID="tx-bulk-apply"
              label={t('tx.bulk.applyCount', { count })}
              disabled={needsValue && !value.trim()}
              onPress={() => {
                if (field === 'delete') setConfirmDelete(true);
                else apply();
              }}
            />
          </Footer>
        }
      >
        <Text tone="textSecondary">{t('tx.bulk.body', { count })}</Text>
        <Select
          testID="tx-bulk-field"
          label={t('tx.bulk.field')}
          options={[
            { value: 'category', label: t('add.category') },
            { value: 'payee', label: t('add.payee') },
            { value: 'account', label: t('add.account') },
            { value: 'tagAdd', label: t('tx.bulk.tagAdd') },
            { value: 'tagRemove', label: t('tx.bulk.tagRemove') },
            { value: 'delete', label: t('tx.delete') },
          ]}
          value={field}
          onChange={(v) => {
            setField(v as BulkField);
            setValue('');
          }}
        />
        {field === 'delete' ? null : field === 'tagAdd' || field === 'tagRemove' ? (
          <TextInput testID="tx-bulk-value" label={t('tx.bulk.tagValue')} value={value} onChangeText={setValue} />
        ) : (
          <Select testID="tx-bulk-value" label={t('tx.bulk.value')} options={options} value={value} onChange={setValue} />
        )}
      </Sheet>
      <Confirm
        visible={confirmDelete}
        title={t('tx.bulk.deleteTitle', { count })}
        body={t('tx.bulk.deleteBody')}
        confirmLabel={t('tx.bulk.deleteConfirm')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          apply();
        }}
      />
    </>
  );
}
