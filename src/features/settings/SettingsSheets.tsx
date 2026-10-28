import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Confirm, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Category, ExchangeRateEntry } from '@/data/workspace/model';
import { t, type TextKey } from '@/i18n';

const sp = tokens.spacing;

const INVITE_ROLES = ['viewer', 'editor', 'admin'] as const;

/** DESIGN popup #50 — Invite member */
export function InviteMemberSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>('editor');
  const [note, setNote] = useState('');

  // Clear the form when the sheet closes.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setEmail('');
      setRole('editor');
      setNote('');
    }
  }

  return (
    <Sheet
      visible={visible}
      title={t('settings.popup.inviteTitle')}
      onClose={onClose}
      testID="settings-invite-sheet"
      footer={
        <Button
          label={t('settings.popup.inviteSend')}
          disabled={!email.trim()}
          onPress={() => {
            toast.show(t('settings.popup.inviteSent'));
            onClose();
          }}
        />
      }
    >
      <TextInput testID="settings-invite-email" label={t('settings.popup.inviteEmail')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Select
        testID="settings-invite-role"
        label={t('settings.popup.inviteRole')}
        value={role}
        onChange={(v) => setRole(v as (typeof INVITE_ROLES)[number])}
        options={INVITE_ROLES.map((r) => ({ value: r, label: t(`settings.workspace.role.${r}` as TextKey) }))}
      />
      <TextInput testID="settings-invite-note" label={t('settings.popup.inviteNote')} value={note} onChangeText={setNote} />
    </Sheet>
  );
}

/** #51 Change role */
export function ChangeRoleSheet({
  member,
  visible,
  onClose,
}: {
  member: { name: string; role: string } | null;
  visible: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState('editor');
  if (!member) return null;
  return (
    <Sheet
      visible={visible}
      title={t('settings.popup.changeRoleTitle', { name: member.name })}
      onClose={onClose}
      testID="settings-change-role-sheet"
      footer={
        <Button
          label={t('panel.save')}
          onPress={() => {
            toast.show(t('common.saved'));
            onClose();
          }}
        />
      }
    >
      <Text tone="textSecondary">{t('settings.popup.changeRoleBody')}</Text>
      <Select
        testID="settings-change-role-select"
        label={t('settings.popup.inviteRole')}
        value={role}
        onChange={(v) => setRole(v)}
        options={INVITE_ROLES.map((r) => ({ value: r, label: t(`settings.workspace.role.${r}` as TextKey) }))}
      />
      <Text variant="caption" tone="textSecondary">
        {t('settings.workspace.rolesBody')}
      </Text>
    </Sheet>
  );
}

/** #56 Exchange rate */
export function ExchangeRateSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: Omit<ExchangeRateEntry, 'id'>) => void | Promise<void>;
}) {
  const toast = useToast();
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState('');
  const [rate, setRate] = useState('');

  // Start empty each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setCurrency('USD');
      setDate('');
      setRate('');
    }
  }

  return (
    <Sheet
      visible={visible}
      title={t('settings.popup.exchangeTitle')}
      onClose={onClose}
      testID="settings-exchange-sheet"
      footer={
        <Button
          label={t('panel.save')}
          disabled={!rate.trim()}
          onPress={() => {
            void Promise.resolve(
              onSave({
                currency: currency.trim() || 'USD',
                date: date.trim() || new Intl.DateTimeFormat('en-CA').format(new Date()),
                rate: rate.trim(),
                source: 'manual',
              }),
            ).then(() => {
              toast.show(t('common.saved'));
              onClose();
            });
          }}
        />
      }
    >
      <TextInput testID="settings-exchange-currency" label={t('settings.popup.exchangeCurrency')} value={currency} onChangeText={setCurrency} />
      <TextInput testID="settings-exchange-date" label={t('settings.popup.exchangeDate')} value={date} onChangeText={setDate} placeholder="2026-10-28" />
      <TextInput testID="settings-exchange-rate" label={t('settings.popup.exchangeRate')} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
    </Sheet>
  );
}

/** #56 API key */
export function ApiKeySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [access, setAccess] = useState<'read' | 'readWrite'>('read');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const key = useMemo(() => (createdKey ? createdKey : null), [createdKey]);

  // Clear the form and the shown key when the sheet closes.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setName('');
      setAccess('read');
      setCreatedKey(null);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={t('settings.popup.apiKeyTitle')}
      onClose={onClose}
      testID="settings-api-key-sheet"
      footer={
        key ? (
          <Button label={t('common.close')} onPress={onClose} />
        ) : (
          <Button
            label={t('settings.popup.apiKeyCreate')}
            disabled={!name.trim()}
            onPress={() => setCreatedKey(`mlj_${Math.random().toString(36).slice(2, 18)}`)}
          />
        )
      }
    >
      {key ? (
        <>
          <Text tone="textSecondary">{t('settings.popup.apiKeyShownOnce')}</Text>
          <Text selectable style={{ fontFamily: 'monospace' }}>
            {key}
          </Text>
          <Button kind="secondary" label={t('settings.popup.apiKeyCopy')} onPress={() => toast.show(t('settings.popup.apiKeyCopied'))} />
        </>
      ) : (
        <>
          <TextInput testID="settings-api-key-name" label={t('settings.popup.apiKeyName')} value={name} onChangeText={setName} />
          <Select
            testID="settings-api-key-access"
            label={t('settings.popup.apiKeyAccess')}
            value={access}
            onChange={(v) => setAccess(v as 'read' | 'readWrite')}
            options={[
              { value: 'read', label: t('settings.popup.apiKeyRead') },
              { value: 'readWrite', label: t('settings.popup.apiKeyReadWrite') },
            ]}
          />
          <Text tone="textSecondary">{t('settings.popup.apiKeyHint')}</Text>
        </>
      )}
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
  const [shownId, setShownId] = useState(category?.id);
  if (category?.id !== shownId) {
    setShownId(category?.id);
    setName(category?.name ?? '');
  }
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
      <Text variant="caption" tone="textSecondary">
        {t('settings.popup.editCategoryHint')}
      </Text>
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

export function PlaceholderTab({ bodyKey }: { bodyKey: TextKey }) {
  return (
    <View style={{ gap: sp['spacing-md'] }}>
      <Text tone="textSecondary">{t(bodyKey)}</Text>
    </View>
  );
}
