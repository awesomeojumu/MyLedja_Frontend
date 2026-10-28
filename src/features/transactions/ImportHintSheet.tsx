import { useRouter } from 'expo-router';

import { Button, Sheet, Text } from '@/design/components';
import { t } from '@/i18n';

/** DESIGN page 11 header Import — routes to account CSV import (page 9 flow). */
export function ImportHintSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <Sheet visible testID="tx-import-sheet" title={t('tx.importTitle')} onClose={onClose} footer={<Button testID="tx-import-go" label={t('tx.importGo')} onPress={() => { onClose(); router.push('/accounts'); }} />}>
      <Text tone="textSecondary">{t('tx.importBody')}</Text>
    </Sheet>
  );
}
