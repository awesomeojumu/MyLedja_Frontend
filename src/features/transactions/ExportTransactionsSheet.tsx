import { Platform, Share } from 'react-native';

import { Button, Sheet, Text } from '@/design/components';
import type { Snapshot } from '@/data/workspace/repository';
import { exportTransactionsCsv } from '@/features/settings/export';
import { t } from '@/i18n';

/** Popup #24 — export transactions CSV (DESIGN page 11). */
export function ExportTransactionsSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const run = async () => {
    const csv = exportTransactionsCsv(snapshot);
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
    </Sheet>
  );
}
