import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Button, Checkbox, PillTag, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';

import { applyDatePreset, type DatePreset } from './filters';
import { DEFAULT_EXPORT_COLUMNS, exportTransactionsCsvFiltered, type ExportColumn } from './exportCsv';
import { today } from './helpers';

const sp = tokens.spacing;

const PRESETS: DatePreset[] = ['thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'lastYear'];
const ALL_COLUMNS: ExportColumn[] = ['date', 'payee', 'category', 'account', 'amount', 'notes', 'tags', 'type', 'status'];

/** Popup #24 — export with range, accounts and columns (addendum PU-24). */
export function ExportTransactionsSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const toast = useToast();
  const year = applyDatePreset('thisYear', today());
  const [dateFrom, setDateFrom] = useState(year.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(year.dateTo ?? today());
  const [accountId, setAccountId] = useState('');
  const [columns, setColumns] = useState<ExportColumn[]>([...DEFAULT_EXPORT_COLUMNS]);
  const accounts = [{ value: '', label: t('tx.filter.anyAccount') }, ...snapshot.accounts.map((a) => ({ value: a.id, label: a.name }))];

  const toggle = (col: ExportColumn) => {
    setColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const run = async () => {
    const csv = exportTransactionsCsvFiltered(snapshot, {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      accountId: accountId || undefined,
      columns: columns.length ? columns : DEFAULT_EXPORT_COLUMNS,
      safeFormulas: true,
    });
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
    toast.show(t('tx.exportReady'));
    onClose();
  };

  return (
    <Sheet
      visible
      testID="tx-export-sheet"
      title={t('tx.exportTitle')}
      onClose={onClose}
      width={480}
      footer={<Button testID="tx-export-run" label={t('tx.exportRun')} disabled={columns.length === 0} onPress={() => void run()} />}
    >
      <Text tone="textSecondary">{t('tx.exportBody')}</Text>
      <Text variant="caption" tone="textSecondary">
        {t('tx.exportSafeCaption')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginVertical: sp['spacing-sm'] }}>
        {PRESETS.map((p) => (
          <PillTag
            key={p}
            testID={`tx-export-preset-${p}`}
            label={t(
              p === 'thisMonth'
                ? 'tx.filter.presetThisMonth'
                : p === 'lastMonth'
                  ? 'tx.filter.presetLastMonth'
                  : p === 'last3Months'
                    ? 'tx.filter.presetLast3Months'
                    : p === 'thisYear'
                      ? 'tx.filter.presetThisYear'
                      : 'tx.filter.presetLastYear',
            )}
            onPress={() => {
              const range = applyDatePreset(p, today());
              setDateFrom(range.dateFrom ?? '');
              setDateTo(range.dateTo ?? '');
            }}
          />
        ))}
      </View>
      <TextInput testID="tx-export-from" label={t('tx.filter.from')} value={dateFrom} onChangeText={setDateFrom} />
      <TextInput testID="tx-export-to" label={t('tx.filter.to')} value={dateTo} onChangeText={setDateTo} />
      <Select testID="tx-export-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <Text variant="caption" tone="textSecondary">
        {t('tx.exportColumns')}
      </Text>
      <View style={{ gap: sp['spacing-xs'] }}>
        {ALL_COLUMNS.map((col) => (
          <Checkbox
            key={col}
            testID={`tx-export-col-${col}`}
            label={t(`tx.export.col.${col}` as 'tx.export.col.date')}
            checked={columns.includes(col)}
            onChange={() => toggle(col)}
          />
        ))}
      </View>
    </Sheet>
  );
}
