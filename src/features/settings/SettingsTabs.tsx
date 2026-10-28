import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { v7 as uuidv7 } from 'uuid';

import {
  Banner,
  Button,
  Card,
  Checkbox,
  Confirm,
  SegmentedControl,
  Select,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import {
  DEFAULT_AI_PREFS,
  DEFAULT_BUDGET_TYPES_SHOWN,
  DEFAULT_DEVICE_SYNC,
  type BudgetTypesShown,
  type ExchangeRateEntry,
} from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnline } from '@/lib/useOnline';
import { t, type TextKey } from '@/i18n';
import Constants from 'expo-constants';

import { exportTransactionsCsv, exportWorkspaceBackupJson } from './export';
import {
  ApiKeySheet,
  BackupCodesSheet,
  ChangeRoleSheet,
  ExchangeRateSheet,
  InviteMemberSheet,
  PasskeySheet,
  RestoreBackupSheet,
  TwoFactorSheet,
} from './SettingsSheets';

const sp = tokens.spacing;

export function AiTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const prefs = { ...DEFAULT_AI_PREFS, ...snapshot?.settings.aiPrefs };

  const save = async (next: typeof prefs) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, aiPrefs: next });
    toast.show(t('common.saved'));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-ai">
      <Text tone="textSecondary">{t('settings.ai.body')}</Text>
      <Card style={{ gap: sp['spacing-sm'] }}>
        <Switch
          testID="settings-ai-suggest"
          label={t('settings.ai.suggestCategories')}
          value={prefs.suggestCategories}
          onChange={(suggestCategories) => void save({ ...prefs, suggestCategories })}
        />
        <Text variant="caption" tone="textSecondary">
          {t('settings.ai.suggestCategoriesDetail')}
        </Text>
      </Card>
      <Card style={{ gap: sp['spacing-sm'] }}>
        <Switch
          testID="settings-ai-statements"
          label={t('settings.ai.readStatements')}
          value={prefs.readStatements}
          onChange={(readStatements) => void save({ ...prefs, readStatements })}
        />
        <Text variant="caption" tone="textSecondary">
          {t('settings.ai.readStatementsDetail')}
        </Text>
      </Card>
    </ScrollView>
  );
}

export function BudgetTabDeep() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const style = snapshot?.settings.budgetStyle ?? 'tracking';
  const carryOverDefault = snapshot?.settings.carryOverDefault ?? true;
  const types = { ...DEFAULT_BUDGET_TYPES_SHOWN, ...snapshot?.settings.budgetTypesShown };

  const saveTypes = async (budgetTypesShown: BudgetTypesShown) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, budgetTypesShown });
    toast.show(t('common.saved'));
  };

  const toggleType = (key: keyof BudgetTypesShown, on: boolean) => {
    void saveTypes({ ...types, [key]: on });
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-budget-deep">
      <Text tone="textSecondary">{t('settings.budget.body')}</Text>
      <SegmentedControl
        testID="settings-budget-style"
        label={t('settings.budget.styleLabel')}
        value={style}
        onChange={(budgetStyle) => {
          if (!snapshot) return;
          void repo.updateSettings({ ...snapshot.settings, budgetStyle }).then(() => toast.show(t('common.saved')));
        }}
        options={[
          { value: 'tracking', label: t('settings.budget.tracking') },
          { value: 'envelope', label: t('settings.budget.envelope') },
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: sp['spacing-md'] }}>
          <Text>{t('settings.budget.carryOverDefault')}</Text>
          <Text variant="caption" tone="textSecondary">
            {t('settings.budget.carryOverHint')}
          </Text>
        </View>
        <Switch
          testID="settings-budget-carry-default"
          label={t('settings.budget.carryOverDefault')}
          value={carryOverDefault}
          onChange={(next) => snapshot && void repo.updateSettings({ ...snapshot.settings, carryOverDefault: next }).then(() => toast.show(t('common.saved')))}
        />
      </View>
      <Text variant="heading-sm">{t('settings.budget.typesShown')}</Text>
      {(['fixed', 'flexible', 'nonMonthly', 'savings'] as const).map((key) => (
        <Checkbox
          key={key}
          testID={`settings-budget-type-${key}`}
          label={t(`budget.type.${key}` as TextKey)}
          checked={types[key]}
          onChange={(checked) => toggleType(key, checked)}
        />
      ))}
    </ScrollView>
  );
}

export function CurrenciesTabDeep() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [rateOpen, setRateOpen] = useState(false);
  const rates = snapshot?.settings.exchangeRates ?? [];
  const downloadDaily = snapshot?.settings.downloadDailyRates ?? false;
  const accountCurrencies = useMemo(() => {
    const set = new Set(snapshot?.accounts.map((a) => a.currency) ?? []);
    return [...set].sort();
  }, [snapshot]);

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-currencies">
      <Text tone="textSecondary">{t('settings.currencies.body')}</Text>
      <TextInput testID="settings-budget-currency" label={t('settings.currencies.budgetCurrency')} value={snapshot?.settings.currency ?? 'NGN'} readOnly />
      <Text variant="heading-sm">{t('settings.currencies.accountCurrencies')}</Text>
      {accountCurrencies.length ? (
        accountCurrencies.map((c) => (
          <Text key={c} tone="textSecondary">
            {c}
          </Text>
        ))
      ) : (
        <Text tone="textSecondary">{t('settings.currencies.noAccounts')}</Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('settings.currencies.downloadDaily')}</Text>
        <Switch
          testID="settings-download-rates"
          label={t('settings.currencies.downloadDaily')}
          value={downloadDaily}
          onChange={(downloadDailyRates) =>
            snapshot && void repo.updateSettings({ ...snapshot.settings, downloadDailyRates }).then(() => toast.show(t('common.saved')))
          }
        />
      </View>
      <Text variant="heading-sm">{t('settings.currencies.ratesTable')}</Text>
      {rates.length === 0 ? (
        <Text tone="textSecondary">{t('settings.currencies.noRates')}</Text>
      ) : (
        rates.map((row) => (
          <Card key={row.id} testID={`settings-rate-${row.id}`}>
            <Text>
              {row.currency} · {row.date} · {row.rate}
            </Text>
            <Text variant="caption" tone="textSecondary">
              {row.source === 'manual' ? t('settings.currencies.sourceManual') : t('settings.currencies.sourceDownload')}
            </Text>
          </Card>
        ))
      )}
      <Button testID="settings-add-rate" kind="secondary" label={t('settings.currencies.addRate')} onPress={() => setRateOpen(true)} />
      <ExchangeRateSheet
        visible={rateOpen}
        onClose={() => setRateOpen(false)}
        onSave={async (entry) => {
          if (!snapshot) return;
          const next = [...rates, { ...entry, id: uuidv7() }];
          await repo.updateSettings({ ...snapshot.settings, exchangeRates: next });
          toast.show(t('common.saved'));
        }}
      />
    </ScrollView>
  );
}

export function BanksTab() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const banks = useMemo(
    () => snapshot?.accounts.filter((a) => !a.archived && (a.type === 'bank' || a.institution)) ?? [],
    [snapshot],
  );

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-banks">
      <Text tone="textSecondary">{t('settings.banks.body')}</Text>
      {banks.map((a) => (
        <Card key={a.id} style={{ gap: sp['spacing-sm'] }} testID={`settings-bank-${a.id}`}>
          <Text variant="heading-sm">{a.name}</Text>
          <Text tone="textSecondary">{a.institution ?? t('settings.banks.manualAccount')}</Text>
          <Text variant="caption" tone="textSecondary">
            {t('settings.banks.lastSync', { when: t('settings.banks.syncNever') })}
          </Text>
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
            <Button testID={`settings-bank-sync-${a.id}`} kind="secondary" label={t('settings.banks.syncNow')} onPress={() => {}} disabled />
            <Button testID={`settings-bank-reconnect-${a.id}`} kind="secondary" label={t('settings.banks.reconnect')} onPress={() => router.push(`/accounts/${a.id}`)} />
          </View>
        </Card>
      ))}
      <Button testID="settings-connect-bank" label={t('settings.banks.connect')} onPress={() => router.push('/accounts')} />
      <Banner message={t('settings.banks.laterPhase')} />
    </ScrollView>
  );
}

type MemberRow = { id: string; name: string; email: string; role: string; lastActive: string };

export function WorkspaceTabDeep() {
  const { snapshot } = useWorkspace();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleMember, setRoleMember] = useState<MemberRow | null>(null);
  const members: MemberRow[] = useMemo(
    () => [
      {
        id: 'owner',
        name: user?.name ?? t('settings.workspace.you'),
        email: user?.email ?? 'you@example.com',
        role: 'owner',
        lastActive: t('settings.workspace.lastActiveToday'),
      },
    ],
    [user],
  );

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-workspace">
      <TextInput testID="settings-workspace-name" label={t('settings.workspace.name')} value={snapshot?.workspaceId ?? ''} readOnly />
      <Select
        testID="settings-workspace-type"
        label={t('settings.workspace.type')}
        value="personal"
        onChange={() => {}}
        options={[{ value: 'personal', label: t('settings.workspace.typePersonal') }]}
      />
      <Text variant="heading-sm">{t('settings.workspace.members')}</Text>
      {members.map((m) => (
        <Card key={m.id} style={{ gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{m.name}</Text>
          <Text tone="textSecondary">{m.email}</Text>
          <Text variant="caption" tone="textSecondary">
            {t(`settings.workspace.role.${m.role}` as TextKey)} · {m.lastActive}
          </Text>
          {m.role !== 'owner' ? (
            <Button testID={`settings-member-role-${m.id}`} kind="secondary" label={t('settings.workspace.changeRole')} onPress={() => setRoleMember(m)} />
          ) : null}
        </Card>
      ))}
      <Button testID="settings-invite" label={t('settings.workspace.invite')} onPress={() => setInviteOpen(true)} />
      <Text variant="heading-sm">{t('settings.workspace.rolesTitle')}</Text>
      <Text tone="textSecondary">{t('settings.workspace.rolesBody')}</Text>
      <Text variant="heading-sm">{t('settings.workspace.activity')}</Text>
      <Text tone="textSecondary">{t('settings.workspace.activityEmpty')}</Text>
      <InviteMemberSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ChangeRoleSheet member={roleMember} visible={roleMember !== null} onClose={() => setRoleMember(null)} />
    </ScrollView>
  );
}

export function SecurityTabDeep() {
  const size = useSizeClass();
  const phone = size === 'phone';
  const web = Platform.OS === 'web';
  const [twoFa, setTwoFa] = useState(false);
  const [codes, setCodes] = useState(false);
  const [passkey, setPasskey] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [hideRecent, setHideRecent] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-security">
      <Text tone="textSecondary">{t('settings.security.body')}</Text>
      <TextInput testID="settings-password" label={t('settings.security.password')} value="" secureTextEntry onChangeText={() => {}} placeholder={t('settings.security.passwordHint')} />
      <Button testID="settings-2fa" kind="secondary" label={t('settings.security.twoFactor')} onPress={() => setTwoFa(true)} />
      <Button testID="settings-backup-codes" kind="secondary" label={t('settings.security.backupCodes')} onPress={() => setCodes(true)} />
      <Button testID="settings-passkey" kind="secondary" label={t('settings.security.passkey')} onPress={() => setPasskey(true)} />
      <Text variant="heading-sm">{t('settings.security.devicesTitle')}</Text>
      <Card>
        <Text>{t('settings.security.thisDevice')}</Text>
        <Text variant="caption" tone="textSecondary">
          {Platform.OS === 'web' ? t('settings.security.sessionWeb') : t('settings.security.sessionPhone')}
        </Text>
        <Button testID="settings-sign-out-others" kind="secondary" label={t('settings.security.signOutOthers')} onPress={() => {}} />
      </Card>
      {!web && phone ? (
        <>
          <Switch testID="settings-app-lock" label={t('settings.security.appLock')} value={appLock} onChange={setAppLock} />
          <Switch testID="settings-privacy-mode" label={t('settings.security.privacyMode')} value={privacyMode} onChange={setPrivacyMode} />
        </>
      ) : null}
      {Platform.OS === 'android' ? (
        <Switch testID="settings-hide-recent" label={t('settings.security.hideRecent')} value={hideRecent} onChange={setHideRecent} />
      ) : null}
      <TwoFactorSheet visible={twoFa} onClose={() => setTwoFa(false)} />
      <BackupCodesSheet visible={codes} onClose={() => setCodes(false)} />
      <PasskeySheet visible={passkey} onClose={() => setPasskey(false)} />
    </ScrollView>
  );
}

export function DevicesTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const online = useOnline();
  const prefs = { ...DEFAULT_DEVICE_SYNC, ...snapshot?.settings.deviceSync };
  const waiting = snapshot?.waiting.size ?? 0;

  const saveDevice = async (deviceSync: typeof prefs) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, deviceSync });
    toast.show(t('common.saved'));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-devices">
      <Text tone="textSecondary">{t('settings.devices.body')}</Text>
      <Card style={{ gap: sp['spacing-sm'] }}>
        <Text variant="heading-sm">{t('settings.devices.syncStatus')}</Text>
        <Text tone="textSecondary">{online ? t('settings.devices.online') : t('settings.devices.offline')}</Text>
        <Text variant="caption" tone="textSecondary">
          {t('settings.devices.lastSynced', { when: prefs.lastSyncedLabel ?? t('settings.devices.justNow') })}
        </Text>
        <Text variant="caption" tone="textSecondary">
          {t('settings.devices.waiting', { count: String(waiting) })}
        </Text>
        <Button testID="settings-sync-now" label={t('settings.devices.syncNow')} onPress={() => toast.show(t('settings.devices.syncStarted'))} />
      </Card>
      <Text variant="heading-sm">{t('settings.devices.offlineCopy')}</Text>
      <Text tone="textSecondary">{t('settings.devices.offlineSize')}</Text>
      <Switch
        testID="settings-use-less-data"
        label={t('settings.devices.useLessData')}
        value={prefs.useLessData}
        onChange={(useLessData) => void saveDevice({ ...prefs, useLessData })}
      />
      <Text variant="caption" tone="textSecondary">
        {t('settings.devices.useLessDataHint')}
      </Text>
      <Text variant="heading-sm">{t('settings.devices.encryption')}</Text>
      <Text tone="textSecondary">{t('settings.devices.encryptionLater')}</Text>
    </ScrollView>
  );
}

export function AdvancedTabDeep() {
  const [apiOpen, setApiOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const toast = useToast();

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-advanced">
      <Text tone="textSecondary">{t('settings.advanced.body')}</Text>
      <Button testID="settings-api-key" kind="secondary" label={t('settings.advanced.apiKey')} onPress={() => setApiOpen(true)} />
      <Text tone="textSecondary">{t('settings.advanced.pluginsLater')}</Text>
      <Text variant="heading-sm">{t('settings.advanced.developer')}</Text>
      <Button testID="settings-reset-cache" kind="secondary" label={t('settings.advanced.resetCache')} onPress={() => setResetOpen(true)} />
      <ApiKeySheet visible={apiOpen} onClose={() => setApiOpen(false)} />
      <Confirm
        visible={resetOpen}
        title={t('settings.advanced.resetConfirmTitle')}
        body={t('settings.advanced.resetConfirmBody')}
        confirmLabel={t('settings.advanced.resetConfirm')}
        onConfirm={() => {
          setResetOpen(false);
          toast.show(t('common.saved'));
        }}
        onCancel={() => setResetOpen(false)}
      />
    </ScrollView>
  );
}

export function ImportExportTabDeep() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const download = (filename: string, content: string, mime: string) => {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-import-export">
      <Text tone="textSecondary">{t('settings.importExport.importBody')}</Text>
      <Button testID="settings-go-accounts" kind="secondary" label={t('settings.importExport.goAccounts')} onPress={() => router.push('/accounts')} />
      <Text variant="heading-sm">{t('settings.importExport.otherApps')}</Text>
      <Text tone="textSecondary">{t('settings.importExport.otherAppsBody')}</Text>
      <Text tone="textSecondary">{t('settings.importExport.exportBody')}</Text>
      <Button
        testID="settings-export-csv"
        label={t('settings.importExport.exportCsv')}
        onPress={() => {
          if (!snapshot) return;
          download('myledja-transactions.csv', exportTransactionsCsv(snapshot), 'text/csv');
          toast.show(t('settings.importExport.exportDone'));
        }}
      />
      <Button
        testID="settings-export-backup"
        kind="secondary"
        label={t('settings.importExport.fullBackup')}
        onPress={() => {
          if (!snapshot) return;
          download('myledja-backup.json', exportWorkspaceBackupJson(snapshot), 'application/json');
          toast.show(t('settings.importExport.backupDone'));
        }}
      />
      <Button testID="settings-restore-backup" kind="secondary" label={t('settings.importExport.restore')} onPress={() => setRestoreOpen(true)} />
      <RestoreBackupSheet visible={restoreOpen} onClose={() => setRestoreOpen(false)} />
      <View style={{ marginTop: sp['spacing-lg'] }}>
        <Button testID="settings-delete-account" kind="secondary" label={t('settings.importExport.deleteAccount')} onPress={() => setDeleteOpen(true)} />
      </View>
      <Confirm
        visible={deleteOpen}
        title={t('settings.importExport.deleteAccountTitle')}
        body={t('settings.importExport.deleteAccountBody')}
        confirmLabel={t('settings.importExport.deleteAccountConfirm')}
        onConfirm={() => {
          setDeleteOpen(false);
          toast.show(t('settings.importExport.deleteAccountQueued'));
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </ScrollView>
  );
}

export function HelpTab() {
  const web = Platform.OS === 'web';
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-help">
      <Text tone="textSecondary">{t('settings.help.body')}</Text>
      <Button testID="settings-help-guide" kind="secondary" label={t('settings.help.guide')} onPress={() => Linking.openURL('https://myledja.com/guide')} />
      {web ? (
        <Button testID="settings-help-shortcuts" kind="secondary" label={t('settings.help.shortcuts')} onPress={() => {}} />
      ) : null}
      <Button testID="settings-help-whats-new" kind="secondary" label={t('settings.help.whatsNew')} onPress={() => {}} />
      <Button testID="settings-help-support" kind="secondary" label={t('settings.help.support')} onPress={() => Linking.openURL('mailto:support@myledja.com')} />
      <Pressable testID="settings-help-terms" accessibilityRole="link" onPress={() => Linking.openURL('https://myledja.com/terms')}>
        <Text tone="textSecondary">{t('settings.help.terms')}</Text>
      </Pressable>
      <Pressable testID="settings-help-privacy" accessibilityRole="link" onPress={() => Linking.openURL('https://myledja.com/privacy')}>
        <Text tone="textSecondary">{t('settings.help.privacy')}</Text>
      </Pressable>
      {web ? (
        <Button testID="settings-install-pwa" kind="secondary" label={t('settings.help.install')} onPress={() => {}} />
      ) : null}
      <Text variant="caption" tone="textSecondary">
        {t('settings.help.version', { version })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('settings.help.byPlanexi')}
      </Text>
    </ScrollView>
  );
}

export function TagsSection() {
  const sampleTags = [
    { name: 'Tax deductible', count: 12 },
    { name: 'Reimbursable', count: 3 },
  ];
  return (
    <View style={{ gap: sp['spacing-sm'] }}>
      <Text variant="heading-sm">{t('settings.categories.tagsTitle')}</Text>
      {sampleTags.map((tag) => (
        <Card key={tag.name}>
          <Text>
            {tag.name} · {t('settings.categories.tagCount', { count: String(tag.count) })}
          </Text>
        </Card>
      ))}
      <Text variant="caption" tone="textSecondary">
        {t('settings.categories.tagsLater')}
      </Text>
    </View>
  );
}
