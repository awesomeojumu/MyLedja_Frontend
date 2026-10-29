import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Amount,
  Button,
  Card,
  Confirm,
  InlineError,
  Menu,
  Panel,
  PillTag,
  Popover,
  Select,
  Text,
  TextInput,
  formatDay,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Payee } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { rulesForPayee } from '@/features/rules/ruleEngine';
import { ruleSentence, payeeMonogram } from '@/features/rules/helpers';
import { t } from '@/i18n';

import { aliasOwner, debtForPayee, payeeTransactions } from './helpers';
import { pickImageUri, readDroppedImage } from './pickMedia';

const sp = tokens.spacing;

export function PayeePanel({
  payee,
  snapshot,
  side,
  onClose,
  onSave,
  onCreateRule,
  onMergeWith,
  onDelete,
}: {
  payee: Payee;
  snapshot: Snapshot;
  side: boolean;
  onClose: () => void;
  onSave: (p: Payee) => Promise<{ ok: boolean; aliasConflict?: string }>;
  onCreateRule: () => void;
  onMergeWith: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const theme = useTheme();
  const router = useRouter();
  // Remount via key={payee.id} from the parent when switching payees.
  const [name, setName] = useState(payee.name);
  const [categoryId, setCategoryId] = useState(payee.defaultCategoryId ?? '');
  const [aliases, setAliases] = useState<string[]>(payee.aliases ?? []);
  const [logoUri, setLogoUri] = useState(payee.logoUri ?? '');
  const [newAlias, setNewAlias] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const native = Platform.OS === 'ios' || Platform.OS === 'android';

  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden);
  const options = [{ value: '', label: t('payees.noUsualCategory') }, ...categories.map((c) => ({ value: c.id, label: c.name }))];
  const txns = useMemo(() => payeeTransactions(snapshot, payee.id, 10), [snapshot, payee.id]);
  const txCount = useMemo(
    () => snapshot.events.filter((e) => e.status === 'posted' && e.payeeId === payee.id).length,
    [snapshot, payee.id],
  );
  const linkedRules = useMemo(() => rulesForPayee(snapshot.rules, payee), [snapshot, payee]);
  const linkedDebt = useMemo(() => debtForPayee(snapshot, payee.id), [snapshot, payee.id]);

  const persist = async (next: Partial<Payee>) => {
    const body: Payee = {
      ...payee,
      name: (next.name ?? name).trim() || payee.name,
      defaultCategoryId: (next.defaultCategoryId !== undefined ? next.defaultCategoryId : categoryId) || undefined,
      aliases: next.aliases ?? aliases,
      logoUri: next.logoUri !== undefined ? next.logoUri || undefined : logoUri || undefined,
    };
    const r = await onSave(body);
    if (!r.ok && r.aliasConflict) {
      setAliasError(t('payees.aliasTaken', { name: r.aliasConflict }));
      return false;
    }
    setAliasError(null);
    return true;
  };

  const addAlias = async () => {
    const value = newAlias.trim();
    if (!value) return;
    const owner = aliasOwner(snapshot, value, payee.id);
    if (owner) {
      setAliasError(t('payees.aliasTaken', { name: owner.name }));
      return;
    }
    if (aliases.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setNewAlias('');
      return;
    }
    const next = [...aliases, value];
    setAliases(next);
    setNewAlias('');
    await persist({ aliases: next });
  };

  const removeAlias = async (value: string) => {
    const next = aliases.filter((a) => a !== value);
    setAliases(next);
    await persist({ aliases: next });
  };

  const applyLogo = async (uri: string) => {
    setLogoUri(uri);
    await persist({ logoUri: uri });
  };

  const changeLogo = async (camera = false) => {
    setLogoMenuOpen(false);
    const uri = await pickImageUri({ camera });
    if (!uri) return;
    await applyLogo(uri);
  };

  const removeLogo = async () => {
    setLogoUri('');
    await persist({ logoUri: '' });
  };

  const onLogoDrop = (e: { preventDefault?: () => void; dataTransfer?: { files?: FileList } }) => {
    e.preventDefault?.();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    void readDroppedImage(file).then((picked) => {
      if (picked?.uri) void applyLogo(picked.uri);
    });
  };

  const logoWebProps =
    Platform.OS === 'web'
      ? ({
          onDragOver: (e: { preventDefault?: () => void }) => e.preventDefault?.(),
          onDrop: onLogoDrop,
        } as object)
      : {};

  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
        <Pressable
          testID="payee-logo"
          accessibilityRole="button"
          accessibilityLabel={t('payees.changeLogo')}
          onPress={() => (native ? setLogoMenuOpen(true) : void changeLogo())}
          {...logoWebProps}
          style={{
            width: 64,
            height: 64,
            borderRadius: tokens.radius['rounded-lg'],
            backgroundColor: theme.tagFill,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {logoUri && !logoUri.startsWith('mono://') ? (
            <Image source={{ uri: logoUri }} style={{ width: 64, height: 64 }} accessibilityIgnoresInvertColors />
          ) : (
            <Text variant="heading-md" style={{ color: theme.tagText }}>
              {payeeMonogram(name)}
            </Text>
          )}
        </Pressable>
        <View style={{ gap: sp['spacing-xs'] }}>
          <Button
            testID="payee-logo-pick"
            kind="link"
            label={t('payees.changeLogo')}
            onPress={() => (native ? setLogoMenuOpen(true) : void changeLogo())}
          />
          {logoUri ? <Button testID="payee-logo-remove" kind="link" label={t('payees.removeLogo')} onPress={() => void removeLogo()} /> : null}
        </View>
        <View style={{ flex: 1 }} />
        <Menu
          testID="payee-menu"
          trigger={(open) => <Button testID="payee-menu-open" kind="secondary" label="⋯" onPress={open} />}
          items={[
            { key: 'merge', label: t('payees.mergeWith'), onPress: onMergeWith },
            {
              key: 'delete',
              label: t('payees.deletePayee'),
              onPress: () => {
                if (txCount > 0) onMergeWith();
                else setConfirmDelete(true);
              },
            },
          ]}
        />
      </View>

      <TextInput
        testID="payee-name"
        label={t('payees.name')}
        value={name}
        onChangeText={setName}
        onBlur={() => void persist({ name })}
      />

      <Select
        testID="payee-category"
        label={t('payees.usualCategory')}
        options={options}
        value={categoryId}
        onChange={(v) => {
          setCategoryId(v);
          void persist({ defaultCategoryId: v });
        }}
      />
      <Text variant="caption" tone="textSecondary">
        {t('payees.usualCategoryHint')}
      </Text>

      <Text variant="heading-sm">{t('payees.aliases')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
        {aliases.map((a) => (
          <PillTag key={a} testID={`payee-alias-${a}`} label={`${a} ×`} onPress={() => void removeAlias(a)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextInput
            testID="payee-alias-input"
            label={t('payees.addAlias')}
            value={newAlias}
            onChangeText={(v) => {
              setNewAlias(v);
              setAliasError(null);
            }}
            onBlur={() => void addAlias()}
          />
        </View>
        <Button testID="payee-alias-add" kind="secondary" label={t('payees.addAliasButton')} onPress={() => void addAlias()} />
      </View>
      {aliasError ? <InlineError testID="payee-alias-error" message={aliasError} /> : null}

      {linkedDebt ? (
        <Pressable
          testID="payee-linked-debt"
          accessibilityRole="button"
          onPress={() => router.push(`/debts/${linkedDebt.id}`)}
        >
          <Card>
            <Text variant="heading-sm">{t('payees.linkedPerson')}</Text>
            <Text tone="textSecondary">{linkedDebt.name}</Text>
          </Card>
        </Pressable>
      ) : null}

      {txns.length ? (
        <View style={{ gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{t('payees.recentTx')}</Text>
          {txns.map((row) => (
            <Pressable key={row.id} accessibilityRole="button" onPress={() => router.push(`/transactions?tx=${row.id}`)}>
              <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text variant="caption" tone="textSecondary">
                    {formatDay(row.date)}
                  </Text>
                  <Text>{row.category || t('payees.noUsualCategory')}</Text>
                </View>
                <Amount minor={row.amount < 0n ? -row.amount : row.amount} />
              </Card>
            </Pressable>
          ))}
          <Button
            testID="payee-see-all"
            kind="link"
            label={t('payees.seeAll')}
            onPress={() => router.push(`/transactions?payee=${payee.id}`)}
          />
        </View>
      ) : null}

      {linkedRules.length ? (
        <View style={{ gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{t('payees.rulesUsing')}</Text>
          {linkedRules.map((rule) => {
            const { when, then } = ruleSentence(rule, snapshot);
            return (
              <Card key={rule.id} style={{ gap: sp['spacing-xs'] }}>
                <Text variant="caption" tone="textSecondary">
                  {when}
                </Text>
                <Text variant="caption">{then}</Text>
              </Card>
            );
          })}
        </View>
      ) : null}
      <Button testID="payee-create-rule" kind="secondary" label={t('payees.createRule')} onPress={onCreateRule} />

      <Popover visible={logoMenuOpen} onClose={() => setLogoMenuOpen(false)} testID="payee-logo-menu">
        <Button testID="payee-logo-library" kind="link" label={t('payees.changeLogo')} onPress={() => void changeLogo(false)} />
        <Button testID="payee-logo-camera" kind="link" label={t('payees.takePhoto')} onPress={() => void changeLogo(true)} />
      </Popover>

      <Confirm
        visible={confirmDelete}
        title={t('payees.deleteTitle', { name: payee.name })}
        body={t('payees.deleteBody')}
        confirmLabel={t('payees.deletePayee')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void onDelete().then((ok) => {
            if (ok) onClose();
          });
        }}
      />
    </>
  );

  if (side) {
    return (
      <View
        testID="payee-panel"
        style={{
          flex: 1,
          maxWidth: 440,
          width: 440,
          borderLeftWidth: 1,
          borderColor: theme.border,
          padding: sp['spacing-lg'],
          gap: sp['spacing-md'],
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading-md" accessibilityRole="header">
            {payee.name}
          </Text>
          <Button kind="link" label={t('common.close')} onPress={onClose} />
        </View>
        {body}
      </View>
    );
  }

  return (
    <Panel visible title={payee.name} onClose={onClose} testID="payee-sheet">
      {body}
    </Panel>
  );
}
