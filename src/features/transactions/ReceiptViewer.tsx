import { useState } from 'react';
import { Image, Platform, ScrollView, View } from 'react-native';

import { Button, Confirm, Sheet, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { t } from '@/i18n';

import { resolveReceiptUrl } from './receiptMeta';

const sp = tokens.spacing;

/** Popup #23 — receipt viewer with short-lived signed links (addendum PU-23). */
export function ReceiptViewer({
  fileId,
  onClose,
  onReplace,
  onRemove,
}: {
  fileId: string;
  onClose: () => void;
  onReplace: (next: string) => void;
  onRemove: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [nextLink, setNextLink] = useState(fileId);
  const resolved = resolveReceiptUrl(fileId);
  const isImage = resolved ? /\.(png|jpe?g|gif|webp)(\?|$)/i.test(resolved) || resolved.startsWith('data:image') : false;

  return (
    <>
      <Sheet
        visible
        testID="receipt-viewer"
        title={t('panel.receiptTitle')}
        onClose={onClose}
        width={Platform.OS === 'web' ? 720 : 480}
        footer={
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
            <Button kind="secondary" testID="receipt-replace" label={t('panel.receiptReplace')} onPress={() => setReplacing(true)} />
            <Button kind="secondary" testID="receipt-remove" label={t('panel.receiptRemove')} onPress={() => setConfirmRemove(true)} />
            <Button testID="receipt-close" label={t('common.close')} onPress={onClose} />
          </View>
        }
      >
        {!resolved ? (
          <Text testID="receipt-expired" tone="textSecondary">
            {t('panel.receiptExpired')}
          </Text>
        ) : (
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} style={{ maxHeight: 480 }}>
            {isImage ? (
              <Image testID="receipt-image" source={{ uri: resolved }} style={{ width: '100%', height: 420, resizeMode: 'contain' }} accessibilityLabel={t('panel.receiptTitle')} />
            ) : (
              <Text testID="receipt-link-text" selectable>
                {resolved}
              </Text>
            )}
          </ScrollView>
        )}
        {replacing ? (
          <View style={{ gap: sp['spacing-sm'], marginTop: sp['spacing-md'] }}>
            <TextInput testID="receipt-replace-input" label={t('panel.receiptLink')} value={nextLink} onChangeText={setNextLink} />
            <Button
              testID="receipt-replace-save"
              label={t('common.saved')}
              onPress={() => {
                onReplace(nextLink.trim());
                setReplacing(false);
              }}
            />
          </View>
        ) : null}
      </Sheet>
      <Confirm
        visible={confirmRemove}
        title={t('panel.receiptRemoveTitle')}
        body={t('panel.receiptRemoveBody')}
        confirmLabel={t('panel.receiptRemove')}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          onRemove();
        }}
      />
    </>
  );
}
