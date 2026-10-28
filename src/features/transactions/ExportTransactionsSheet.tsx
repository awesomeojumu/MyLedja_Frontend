import { useState } from 'react';

import { Button, Select, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { Platform, Share } from 'react-native';
import { t } from '@/i18n';

import { exportTransactionsCsvFiltered } from './exportCsv';
import { today } from './helpers';

const sp = tokens.spacing;

/** Popup #24 — export with range and account (DESIGN page 11). */
export function ExportTransactionsSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [safeFormulas, setSafeFormulas] = useState(true);
  const accounts = [{ value: '', label: t('tx.filter.anyAccount') }, ...snapshot.accounts.map((a) => ({ value: a.id, label: a.name }))];

  const run = async () => {
    let csv = exportTransactionsCsvFiltered(snapshot, {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      accountId: accountId || undefined,
    });
    if (safeFormulas) csv = csv.replace(/^([=+\-@])/gm, "'$1");
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'myledja-transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: csv, title: t('tx.exportTitle') });
    }
    onClose();
  };

  return (
    <Sheet visible testID="tx-export-sheet" title={t('tx.exportTitle')} onClose={onClose} footer={<Button testID="tx-export-run" label={t('tx.exportRun')} onPress={() => void run()} />}>
      <Text tone="textSecondary">{t('tx.exportBody')}</Text>
      <TextInput testID="tx-export-from" label={t('tx.filter.from')} value={dateFrom} onChangeText={setDateFrom} />
      <TextInput testID="tx-export-to" label={t('tx.filter.to')} value={dateTo} onChangeText={setDateTo} />
      <Select testID="tx-export-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <Switch testID="tx-export-safe" label={t('tx.exportSafeFormulas')} value={safeFormulas} onChange={setSafeFormulas} />
      <Text variant="caption" tone="textSecondary" style={{ marginTop: sp['spacing-xs'] }}>
        {t('tx.exportSafeCaption')}
      </Text>
    </Sheet>
  );
}
