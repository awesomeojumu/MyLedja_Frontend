import { useState } from 'react';
import { View } from 'react-native';

import { Button, Confirm, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Category } from '@/data/workspace/model';
import { t } from '@/i18n';

const sp = tokens.spacing;

/** DESIGN popup #50 — Invite member */
export function InviteMemberSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  return (
    <Sheet visible={visible} title={t('settings.popup.inviteTitle')} onClose={onClose} testID="settings-invite-sheet" footer={<Button label={t('settings.popup.inviteSend')} onPress={() => { toast.show(t('common.saved')); onClose(); }} />}>
      <TextInput label={t('settings.popup.inviteEmail')} value={email} onChangeText={setEmail} />
      <TextInput label={t('settings.popup.inviteRole')} value={role} onChangeText={setRole} />
      <TextInput label={t('settings.popup.inviteNote')} value="" onChangeText={() => {}} />
    </Sheet>
  );
}

/** #52 Set up two-factor */
export function TwoFactorSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={t('settings.popup.twoFactorTitle')} onClose={onClose} testID="settings-2fa-sheet">
      <Text tone="textSecondary">{t('settings.popup.twoFactorBody')}</Text>
      <TextInput label={t('settings.popup.twoFactorCode')} value="" onChangeText={() => {}} keyboardType="number-pad" />
    </Sheet>
  );
}

/** #53 Backup codes */
export function BackupCodesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={t('settings.popup.backupCodesTitle')} onClose={onClose} testID="settings-backup-codes-sheet">
      <Text tone="textSecondary">{t('settings.popup.backupCodesBody')}</Text>
    </Sheet>
  );
}

/** #54 Add passkey */
export function PasskeySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={t('settings.popup.passkeyTitle')} onClose={onClose} testID="settings-passkey-sheet">
      <TextInput label={t('settings.popup.passkeyName')} value="" onChangeText={() => {}} />
    </Sheet>
  );
}

/** #55 Restore backup */
export function RestoreBackupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Sheet visible={visible} title={t('settings.popup.restoreTitle')} onClose={onClose} testID="settings-restore-sheet" footer={<Button kind="secondary" label={t('settings.popup.restorePick')} onPress={() => setOpen(true)} />}>
        <Text tone="textSecondary">{t('settings.popup.restoreBody')}</Text>
      </Sheet>
      <Confirm visible={open} title={t('settings.popup.restoreConfirmTitle')} body={t('settings.popup.restoreConfirmBody')} confirmLabel={t('settings.popup.restoreConfirm')} onConfirm={() => { setOpen(false); onClose(); }} onCancel={() => setOpen(false)} />
    </>
  );
}

/** #56 API key / exchange rate (two forms) */
export function ExchangeRateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  return (
    <Sheet visible={visible} title={t('settings.popup.exchangeTitle')} onClose={onClose} testID="settings-exchange-sheet" footer={<Button label={t('panel.save')} onPress={() => { toast.show(t('common.saved')); onClose(); }} />}>
      <TextInput label={t('settings.popup.exchangeCurrency')} value="USD" onChangeText={() => {}} />
      <TextInput label={t('settings.popup.exchangeRate')} value="" onChangeText={() => {}} keyboardType="decimal-pad" />
    </Sheet>
  );
}

export function ApiKeySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={t('settings.popup.apiKeyTitle')} onClose={onClose} testID="settings-api-key-sheet">
      <TextInput label={t('settings.popup.apiKeyName')} value="" onChangeText={() => {}} />
      <Text tone="textSecondary">{t('settings.popup.apiKeyHint')}</Text>
    </Sheet>
  );
}

/** #11 Edit category (Settings tab) */
export function EditCategorySheet({
  category,
  visible,
  onClose,
  onSave,
}: {
  category: Category | null;
  visible: boolean;
  onClose: () => void;
  onSave: (c: Category) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? '');
  if (!category) return null;
  return (
    <Sheet
      visible={visible}
      title={t('settings.popup.editCategoryTitle')}
      onClose={onClose}
      testID="settings-edit-category-sheet"
      footer={<Button label={t('panel.save')} onPress={() => void onSave({ ...category, name: name.trim() || category.name }).then(onClose)} />}
    >
      <TextInput testID="settings-edit-cat-name" label={t('settings.categories.name')} value={name} onChangeText={setName} />
    </Sheet>
  );
}

/** #12 Delete category */
export function DeleteCategorySheet({
  category,
  visible,
  onClose,
  onConfirm,
}: {
  category: Category | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!category) return null;
  return (
    <Confirm
      visible={visible}
      title={t('settings.popup.deleteCategoryTitle', { name: category.name })}
      body={t('settings.popup.deleteCategoryBody')}
      confirmLabel={t('settings.popup.deleteCategoryConfirm')}
      onConfirm={() => void onConfirm().then(onClose)}
      onCancel={onClose}
    />
  );
}

export function PlaceholderTab({ bodyKey }: { bodyKey: string }) {
  return (
    <View style={{ gap: sp['spacing-md'] }}>
      <Text tone="textSecondary">{t(bodyKey as 'settings.ai.body')}</Text>
    </View>
  );
}
