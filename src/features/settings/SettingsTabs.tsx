import { useCallback, useEffect, useMemo, useState } from 'react';
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
  DEFAULT_BUDGET_TYPES_SHOWN,
  DEFAULT_DEVICE_SYNC,
  type BudgetTypesShown,
} from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnline } from '@/lib/useOnline';
import { useAppLockSetting } from '@/features/lock/AppLock';
import { t, type TextKey } from '@/i18n';
import Constants from 'expo-constants';

import { ApiError } from '@/api/client';
import type { ActivityEvent, DeviceSession, SecurityStatus } from '@/api/security';
import { type AiConsent, type AiSettings, aiApi, type BankLink } from '@/api/ai';
import { ConnectBankSheet } from '@/features/accounts/accountSheets';
import { bankConnectAvailable, openMonoConnect } from '@/features/banking/monoConnect';
import { formatDay } from '@/design/components/overlays';
import { passkeysAvailable } from '@/features/auth/passkey';

import { ApiKeySheet, ChangeRoleSheet, ExchangeRateSheet, InviteMemberSheet } from './SettingsSheets';
import {
  BackupCodesSheet,
  ChangePasswordSheet,
  DeleteAccountSheet,
  PasskeySheet,
  RestoreBackupSheet,
  saveText,
  TwoFactorSheet,
  useRecheck,
  useSecurityApi,
} from './SecuritySheets';

const sp = tokens.spacing;

export function AiTab() {
  const { client, user } = useAuth();
  const toast = useToast();
  const api = useMemo(() => aiApi(client), [client]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const workspaceId = user?.workspaceId;

  useEffect(() => {
    if (!workspaceId) return;
    api.settings(workspaceId).then(setSettings, () => setFailed(true));
  }, [api, workspaceId]);

  const save = async (key: keyof AiConsent, on: boolean) => {
    if (!settings || !workspaceId) return;
    const { updatedAt: _u, ...consent } = settings.consent;
    try {
      setSettings(await api.setConsent(workspaceId, { ...consent, [key]: on }));
      toast.show(t('common.saved'));
    } catch (e) {
      toast.show(e instanceof ApiError ? e.body.message : t('errors.network'));
    }
  };

  const on = settings && (settings.available.claude || settings.available.gemini);
  const rows: { key: keyof AiConsent; label: TextKey; detail: TextKey }[] = [
    { key: 'categorize', label: 'settings.ai.suggestCategories', detail: 'settings.ai.suggestCategoriesDetail' },
    { key: 'statements', label: 'settings.ai.readStatements', detail: 'settings.ai.readStatementsDetail' },
    // Health advice joins when Health ships (Phase 5, DESIGN principle 12).
  ];
  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-ai">
      <Text tone="textSecondary">{t('settings.ai.body')}</Text>
      {(settings && !on) || failed || !workspaceId ? <Banner message={t('settings.ai.unavailable')} /> : null}
      {on
        ? rows.map((r) => (
            <Card key={r.key} style={{ gap: sp['spacing-sm'] }}>
              <Switch testID={`settings-ai-${r.key}`} label={t(r.label)} value={settings.consent[r.key]} onChange={(v) => void save(r.key, v)} />
              <Text variant="caption" tone="textSecondary">
                {t(r.detail)}
              </Text>
            </Card>
          ))
        : null}
    </ScrollView>
  );
}

export function BudgetTabDeep() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const style = snapshot?.settings.budgetStyle ?? 'tracking';
  const carryOverDefault = snapshot?.settings.carryOverDefault ?? true;
  const types = { ...DEFAULT_BUDGET_TYPES_SHOWN, ...snapshot?.settings.budgetTypesShown };
  const [pendingStyle, setPendingStyle] = useState<'tracking' | 'envelope' | null>(null);

  const saveTypes = async (budgetTypesShown: BudgetTypesShown) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, budgetTypesShown });
    toast.show(t('common.saved'));
  };

  const toggleType = (key: keyof BudgetTypesShown, on: boolean) => {
    void saveTypes({ ...types, [key]: on });
  };

  const applyStyle = async (budgetStyle: 'tracking' | 'envelope') => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, budgetStyle });
    toast.show(t('common.saved'));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-budget-deep">
      <Text tone="textSecondary">{t('settings.budget.body')}</Text>
      <SegmentedControl
        testID="settings-budget-style"
        label={t('settings.budget.styleLabel')}
        value={style}
        onChange={(budgetStyle) => {
          if (!snapshot || budgetStyle === style) return;
          setPendingStyle(budgetStyle as 'tracking' | 'envelope');
        }}
        options={[
          { value: 'tracking', label: t('settings.budget.tracking') },
          { value: 'envelope', label: t('settings.budget.envelope') },
        ]}
      />
      <Text variant="caption" tone="textSecondary">
        {style === 'envelope' ? t('settings.budget.envelopeMeaning') : t('settings.budget.trackingMeaning')}
      </Text>
      <Switch
        testID="settings-budget-carry-default"
        label={t('settings.budget.carryOverDefault')}
        value={carryOverDefault}
        onChange={(next) => snapshot && void repo.updateSettings({ ...snapshot.settings, carryOverDefault: next }).then(() => toast.show(t('common.saved')))}
      />
      <Text variant="caption" tone="textSecondary">
        {t('settings.budget.carryOverHint')}
      </Text>
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
      <Confirm
        visible={pendingStyle !== null}
        title={t('settings.budget.switchTitle', {
          style: pendingStyle === 'envelope' ? t('settings.budget.envelope') : t('settings.budget.tracking'),
        })}
        body={t('settings.budget.switchBody')}
        confirmLabel={t('settings.budget.switchConfirm')}
        onCancel={() => setPendingStyle(null)}
        onConfirm={() => {
          const next = pendingStyle;
          setPendingStyle(null);
          if (next) void applyStyle(next);
        }}
      />
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
  const { client, user } = useAuth();
  const toast = useToast();
  const api = useMemo(() => aiApi(client), [client]);
  const [links, setLinks] = useState<BankLink[] | null>(null);
  const [available, setAvailable] = useState(false);
  const [connect, setConnect] = useState(false);
  const workspaceId = user?.workspaceId;
  const accountName = (id: string) => snapshot?.accounts.find((a) => a.id === id)?.name ?? '';

  const load = useCallback(() => {
    if (!workspaceId) return;
    api.bankLinks(workspaceId).then(
      (r) => {
        setLinks(r.links);
        setAvailable(r.available);
      },
      () => setLinks([]),
    );
  }, [api, workspaceId]);
  useEffect(load, [load]);

  const run = (action: () => Promise<void>) => void action().catch((e: unknown) => toast.show(e instanceof ApiError ? e.body.message : t('errors.network')));

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-banks">
      <Text tone="textSecondary">{t('settings.banks.body')}</Text>
      {links && links.length === 0 ? <Text tone="textSecondary">{t('settings.banks.none')}</Text> : null}
      {(links ?? []).map((l) => (
        <Card key={l.id} style={{ gap: sp['spacing-sm'] }} testID={`settings-bank-${l.id}`}>
          <Text variant="heading-sm">{l.last4 ? t('settings.banks.ending', { bank: l.institution, last4: l.last4 }) : l.institution}</Text>
          <Text tone="textSecondary">{accountName(l.accountId)}</Text>
          <Text variant="caption" tone="textSecondary">
            {l.status === 'needs_reauth'
              ? t('settings.banks.needsReauth')
              : t('settings.banks.lastSync', { when: l.lastSyncedAt ? formatDay(l.lastSyncedAt.slice(0, 10)) : t('settings.banks.syncNever') })}
          </Text>
          <Text variant="caption" tone="textSecondary">
            {l.consentExpiresAt
              ? t('settings.banks.consentUntil', { date: formatDay(l.consentExpiresAt.slice(0, 10)) })
              : t('settings.banks.consentOngoing')}
          </Text>
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
            <Button
              testID={`settings-bank-sync-${l.id}`}
              kind="secondary"
              label={t('settings.banks.syncNow')}
              onPress={() =>
                run(async () => {
                  const r = await api.syncBank(workspaceId!, l.id);
                  toast.show(r.newTransactions ? t('settings.banks.synced', { count: String(r.newTransactions) }) : t('settings.banks.upToDate'));
                  load();
                })
              }
            />
            {bankConnectAvailable() ? (
              <Button
                testID={`settings-bank-reconnect-${l.id}`}
                kind="secondary"
                label={t('settings.banks.reconnect')}
                onPress={() =>
                  run(async () => {
                    const { reauthToken } = await api.reauthBank(workspaceId!, l.id);
                    if (await openMonoConnect(reauthToken)) {
                      await api.bankReconnected(workspaceId!, l.id);
                      toast.show(t('settings.banks.reconnected'));
                      load();
                    }
                  })
                }
              />
            ) : null}
            <Button
              kind="secondary"
              label={t('settings.banks.disconnect')}
              onPress={() =>
                run(async () => {
                  await api.disconnectBank(workspaceId!, l.id);
                  toast.show(t('settings.banks.disconnected'));
                  load();
                })
              }
            />
          </View>
        </Card>
      ))}
      {available && bankConnectAvailable() ? (
        <Button testID="settings-connect-bank" label={t('settings.banks.connect')} onPress={() => setConnect(true)} />
      ) : (
        <Banner message={t('settings.banks.unavailable')} />
      )}
      {connect ? (
        <ConnectBankSheet
          onClose={() => {
            setConnect(false);
            load();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

type MemberRow = { id: string; name: string; email: string; role: string; lastActive: string };

export function WorkspaceTabDeep() {
  const { snapshot, repo } = useWorkspace();
  const { user } = useAuth();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleMember, setRoleMember] = useState<MemberRow | null>(null);
  const [name, setName] = useState(snapshot?.settings.workspaceName ?? user?.workspaceName ?? 'Personal');
  const [timeZone, setTimeZone] = useState(snapshot?.settings.timeZone ?? 'Africa/Lagos');
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

  const saveWorkspace = async (patch: { workspaceName?: string; timeZone?: string }) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, ...patch });
    toast.show(t('common.saved'));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-workspace">
      <TextInput
        testID="settings-workspace-name"
        label={t('settings.workspace.name')}
        value={name}
        onChangeText={setName}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== snapshot?.settings.workspaceName) void saveWorkspace({ workspaceName: trimmed });
        }}
      />
      <Select
        testID="settings-workspace-timezone"
        label={t('settings.workspace.timeZone')}
        value={timeZone}
        onChange={(tz) => {
          setTimeZone(tz);
          void saveWorkspace({ timeZone: tz });
        }}
        options={[
          { value: 'Africa/Lagos', label: 'Africa/Lagos' },
          { value: 'UTC', label: 'UTC' },
        ]}
      />
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
      <ActivityLog />
      <InviteMemberSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ChangeRoleSheet member={roleMember} visible={roleMember !== null} onClose={() => setRoleMember(null)} />
    </ScrollView>
  );
}

export function SecurityTabDeep() {
  const size = useSizeClass();
  const phone = size === 'phone';
  const web = Platform.OS === 'web';
  const api = useSecurityApi();
  const toast = useToast();
  const recheck = useRecheck();
  const lock = useAppLockSetting();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twoFa, setTwoFa] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesRegenerated, setCodesRegenerated] = useState(false);
  const [passkey, setPasskey] = useState(false);
  const [password, setPassword] = useState(false);
  const [turnOff, setTurnOff] = useState(false);
  const [removePasskeyId, setRemovePasskeyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.status().then(setStatus, () => setError(t('settings.security.loadFailed')));
  }, [api]);
  useEffect(load, [load]);

  const act = (action: () => Promise<void>) =>
    recheck.guard(action).catch((e: unknown) => toast.show(e instanceof ApiError ? e.body.message : t('errors.network')));

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-security">
      <Text tone="textSecondary">{t('settings.security.body')}</Text>
      {error ? <Banner message={error} /> : null}
      <Button
        testID="settings-password"
        kind="secondary"
        label={status?.hasPassword === false ? t('settings.security.setPassword') : t('settings.security.changePassword')}
        onPress={() => setPassword(true)}
      />

      <Text variant="heading-sm">{t('settings.security.twoFactor')}</Text>
      <Card style={{ gap: sp['spacing-sm'] }}>
        <Text>{status?.twoFactorOn ? t('settings.security.twoFactorOn') : t('settings.security.twoFactorOff')}</Text>
        {status?.twoFactorOn ? (
          <>
            <Text variant="caption" tone="textSecondary">
              {t('settings.security.codesLeft', { count: String(status.backupCodesLeft) })}
            </Text>
            <Button
              testID="settings-backup-codes"
              kind="secondary"
              label={t('settings.security.newBackupCodes')}
              onPress={() =>
                void act(async () => {
                  setCodesRegenerated(true);
                  setCodes((await api.newBackupCodes()).backupCodes);
                })
              }
            />
            <Button testID="settings-2fa-off" kind="secondary" label={t('settings.security.turnOffTwoFactor')} onPress={() => setTurnOff(true)} />
          </>
        ) : (
          <Button testID="settings-2fa" kind="secondary" label={t('settings.security.setUpTwoFactor')} onPress={() => setTwoFa(true)} />
        )}
      </Card>

      {passkeysAvailable() ? (
        <>
          <Text variant="heading-sm">{t('settings.security.passkeysTitle')}</Text>
          <Card style={{ gap: sp['spacing-sm'] }}>
            {(status?.passkeys ?? []).length === 0 ? <Text tone="textSecondary">{t('settings.security.noPasskeys')}</Text> : null}
            {(status?.passkeys ?? []).map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text>{p.name}</Text>
                  <Text variant="caption" tone="textSecondary">
                    {t('settings.security.addedOn', { date: formatDay(p.createdAt.slice(0, 10)) })}
                  </Text>
                </View>
                <Button kind="link" label={t('settings.security.removePasskey')} onPress={() => setRemovePasskeyId(p.id)} />
              </View>
            ))}
            <Button testID="settings-passkey" kind="secondary" label={t('settings.security.passkey')} onPress={() => setPasskey(true)} />
          </Card>
        </>
      ) : null}

      <Text variant="heading-sm">{t('settings.security.devicesTitle')}</Text>
      <SessionsList />

      {!web && phone ? (
        <>
          <Switch testID="settings-app-lock" label={t('settings.security.appLock')} value={lock.enabled} onChange={(v) => void lock.setEnabled(v)} />
          <Switch testID="settings-privacy-mode" label={t('settings.security.privacyMode')} value={lock.privacyDefault} onChange={(v) => void lock.setPrivacyDefault(v)} />
        </>
      ) : null}
      {Platform.OS === 'android' ? (
        <Switch testID="settings-hide-recent" label={t('settings.security.hideRecent')} value={lock.hideInRecents} onChange={(v) => void lock.setHideInRecents(v)} />
      ) : null}

      <TwoFactorSheet
        visible={twoFa}
        onClose={() => setTwoFa(false)}
        onDone={(c) => {
          setTwoFa(false);
          setCodes(c);
          load();
        }}
      />
      <BackupCodesSheet
        codes={codes}
        regenerated={codesRegenerated}
        onClose={() => {
          setCodes(null);
          setCodesRegenerated(false);
        }}
      />
      <PasskeySheet
        visible={passkey}
        onClose={() => setPasskey(false)}
        onAdded={() => {
          setPasskey(false);
          load();
        }}
      />
      <ChangePasswordSheet
        visible={password}
        onClose={() => setPassword(false)}
        guard={recheck.guard}
        googleOnly={status?.hasPassword === false}
      />
      <Confirm
        visible={turnOff}
        title={t('settings.security.turnOffTitle')}
        body={t('settings.security.turnOffBody')}
        confirmLabel={t('settings.security.turnOffTwoFactor')}
        onConfirm={() => {
          setTurnOff(false);
          void act(async () => {
            await api.twoFactorOff();
            toast.show(t('settings.security.twoFactorTurnedOff'));
            load();
          });
        }}
        onCancel={() => setTurnOff(false)}
      />
      <Confirm
        visible={removePasskeyId !== null}
        title={t('settings.security.removePasskeyTitle')}
        body={t('settings.security.removePasskeyBody')}
        confirmLabel={t('settings.security.removePasskey')}
        onConfirm={() => {
          const id = removePasskeyId;
          setRemovePasskeyId(null);
          if (!id) return;
          void act(async () => {
            await api.passkeyRemove(id);
            toast.show(t('settings.security.passkeyRemoved'));
            load();
          });
        }}
        onCancel={() => setRemovePasskeyId(null)}
      />
      {recheck.sheet}
    </ScrollView>
  );
}

/** Devices and sessions: this device marked; web sessions that stay signed in labelled (DESIGN page 26). */
function SessionsList() {
  const api = useSecurityApi();
  const toast = useToast();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const load = useCallback(() => {
    api.sessions().then((r) => setSessions(r.sessions), () => setSessions([]));
  }, [api]);
  useEffect(load, [load]);

  return (
    <Card style={{ gap: sp['spacing-sm'] }} testID="settings-sessions">
      {(sessions ?? []).map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
          <View style={{ flex: 1 }}>
            <Text>{s.current ? t('settings.security.thisDevice') : (s.deviceName ?? t('settings.security.unnamedDevice'))}</Text>
            <Text variant="caption" tone="textSecondary">
              {s.staysSignedIn ? `${t('settings.security.staysSignedIn')} · ` : ''}
              {t('settings.security.lastUsed', { date: formatDay(s.lastUsedAt.slice(0, 10)) })}
            </Text>
          </View>
          {!s.current ? (
            <Button
              kind="link"
              label={t('settings.security.signOut')}
              onPress={() =>
                void api.signOutSession(s.id).then(() => {
                  toast.show(t('settings.security.signedOut'));
                  load();
                })
              }
            />
          ) : null}
        </View>
      ))}
      <Button
        testID="settings-sign-out-others"
        kind="secondary"
        label={t('settings.security.signOutOthers')}
        onPress={() =>
          void api.signOutOthers().then(() => {
            toast.show(t('settings.security.signedOutOthers'));
            load();
          })
        }
      />
    </Card>
  );
}

/** Activity log: who did what, when, filterable (DESIGN page 26, B3.9). */
function ActivityLog() {
  const api = useSecurityApi();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const workspaceId = user?.workspaceId;

  useEffect(() => {
    if (!workspaceId) return;
    let alive = true;
    api.activity(workspaceId, filter ? { action: filter } : {}).then(
      (r) => {
        if (!alive) return;
        setEvents(r.events);
        setNext(r.nextBefore);
      },
      () => alive && setEvents([]),
    );
    return () => {
      alive = false;
    };
  }, [api, workspaceId, filter]);

  const more = async () => {
    if (!workspaceId || !next) return;
    const r = await api.activity(workspaceId, { before: next, ...(filter ? { action: filter } : {}) });
    setEvents((cur) => [...(cur ?? []), ...r.events]);
    setNext(r.nextBefore);
  };

  return (
    <View style={{ gap: sp['spacing-sm'] }} testID="settings-activity">
      <SegmentedControl
        label={t('settings.workspace.activityFilter')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: '', label: t('settings.workspace.activityAll') },
          { value: 'transaction.', label: t('settings.workspace.activityMoney') },
          { value: 'session.', label: t('settings.workspace.activitySignIns') },
          { value: 'security.', label: t('settings.workspace.activitySecurity') },
        ]}
      />
      {events && events.length === 0 ? <Text tone="textSecondary">{t('settings.workspace.activityEmpty')}</Text> : null}
      {(events ?? []).map((e) => (
        <View key={e.id} style={{ gap: 2 }}>
          <Text>{activityLabel(e.action)}</Text>
          <Text variant="caption" tone="textSecondary">
            {[e.who, e.device, formatDay(e.at.slice(0, 10))].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ))}
      {next ? <Button kind="link" label={t('settings.workspace.activityMore')} onPress={() => void more()} /> : null}
    </View>
  );
}

function activityLabel(action: string): string {
  const key = `activity.${action}` as TextKey;
  const text = t(key);
  return text === key ? t('activity.other') : text;
}

export function DevicesTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const online = useOnline();
  const prefs = { ...DEFAULT_DEVICE_SYNC, ...snapshot?.settings.deviceSync };
  const waitingIds = snapshot ? [...snapshot.waiting] : [];
  const waiting = waitingIds.length;

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
        {waitingIds.length > 0 ? (
          <View style={{ gap: sp['spacing-xs'] }} testID="settings-sync-waiting-list">
            {waitingIds.slice(0, 8).map((id) => (
              <Text key={id} variant="caption" tone="textSecondary">
                {id}
              </Text>
            ))}
          </View>
        ) : null}
        <Button
          testID="settings-sync-now"
          label={t('settings.devices.syncNow')}
          onPress={() => {
            toast.show(t('settings.devices.syncStarted'));
            void repo.refreshBillNotifications();
          }}
        />
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
  const router = useRouter();
  const toast = useToast();
  const api = useSecurityApi();
  const recheck = useRecheck();
  const { user, signOut } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const workspaceId = user?.workspaceId;

  const run = (action: () => Promise<void>) =>
    recheck.guard(action).catch((e: unknown) => toast.show(e instanceof ApiError ? e.body.message : t('errors.network')));

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
        onPress={() =>
          void run(async () => {
            if (!workspaceId) return;
            const file = await api.exportCsv(workspaceId);
            await saveText(file.filename, file.content, file.mimeType);
            toast.show(t('settings.importExport.exportDone'));
          })
        }
      />
      <Button
        testID="settings-export-backup"
        kind="secondary"
        label={t('settings.importExport.fullBackup')}
        onPress={() =>
          void run(async () => {
            if (!workspaceId) return;
            const file = await api.backup(workspaceId);
            await saveText(file.filename, file.content, file.mimeType);
            toast.show(t('settings.importExport.backupDone'));
          })
        }
      />
      <Button testID="settings-restore-backup" kind="secondary" label={t('settings.importExport.restore')} onPress={() => setRestoreOpen(true)} />
      <RestoreBackupSheet visible={restoreOpen} onClose={() => setRestoreOpen(false)} guard={recheck.guard} />
      <View style={{ marginTop: sp['spacing-lg'] }}>
        <Button testID="settings-delete-account" kind="secondary" label={t('settings.importExport.deleteAccount')} onPress={() => setDeleteOpen(true)} />
      </View>
      <DeleteAccountSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        guard={recheck.guard}
        onDeleted={async () => {
          await signOut();
        }}
      />
      {recheck.sheet}
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

/** @deprecated Tags CRUD lives in SettingsScreen CategoriesTab (TB-11 Phase 1). */
export function TagsSection() {
  return null;
}
