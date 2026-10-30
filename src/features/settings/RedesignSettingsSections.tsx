import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_NOTIFICATION_PREFS } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useDesign } from '@/design/ThemeProvider';
import { useToast } from '@/design/components';
import {
  RedesignButton,
  RedesignDialog,
  RedesignField,
  RedesignListRow,
  RedesignSheet,
  RedesignStackFrame,
  RedesignSwitch,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t, type TextKey } from '@/i18n';
import { LOCK_AFTER_OPTIONS, type LockAfterMs, useAppLockSetting } from '@/features/lock/AppLock';
import { formatNaira } from '@/money';
import type { SettingsTabId } from './shipped';
import { REDESIGN_SETTINGS_TITLE } from './redesignNav';
import {
  AiTab,
  BanksTab,
  DevicesTab,
  HelpTab,
  SecurityTabDeep,
  WorkspaceTabDeep,
} from './SettingsTabs';

function lockAfterLabel(ms: LockAfterMs): string {
  if (ms === 0) return t('settings.redesign.lockAfterImmediate');
  if (ms === 60_000) return t('settings.redesign.lockAfter1m');
  return t('settings.redesign.lockAfter5m');
}

const sp = tokens.space;
const shape = tokens.shape;

export function RedesignSettingsSection({ tab }: { tab: SettingsTabId }) {
  const router = useRouter();
  const title = t(REDESIGN_SETTINGS_TITLE[tab] as TextKey);
  return (
    <RedesignStackFrame
      testID={`redesign-settings-${tab}`}
      title={title}
      onBack={() => router.push('/settings')}
    >
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
        {tab === 'general' ? <GeneralSection /> : null}
        {tab === 'budget' ? <BudgetSection /> : null}
        {tab === 'categories' ? <CategoriesSection /> : null}
        {tab === 'notifications' ? <NotificationsSection /> : null}
        {tab === 'security' ? <SecuritySection /> : null}
        {tab === 'devices' ? <DevicesSection /> : null}
        {tab === 'banks' ? <BanksSection /> : null}
        {tab === 'importExport' ? <ImportExportSection /> : null}
        {tab === 'currencies' ? <CurrenciesSection /> : null}
        {tab === 'workspace' ? <WorkspaceSection /> : null}
        {tab === 'ai' ? <AiSection /> : null}
        {tab === 'advanced' ? <AdvancedSection /> : null}
        {tab === 'help' ? <HelpSection /> : null}
      </ScrollView>
    </RedesignStackFrame>
  );
}

function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        padding: sp.lg,
        gap: sp.lg,
      }}
    >
      {children}
    </View>
  );
}

function PickerRow({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={{ gap: sp.xs }}>
      <RedesignText variant="label">{label}</RedesignText>
      <View
        style={{
          minHeight: tokens.size['control-lg'],
          borderWidth: 1,
          borderColor: theme.borderStrong,
          borderRadius: shape['radius-md'],
          paddingHorizontal: sp.md,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.surface,
        }}
      >
        <RedesignText style={{ flex: 1 }}>{value}</RedesignText>
        <RedesignText tone="textSecondary">▾</RedesignText>
      </View>
    </Pressable>
  );
}

function OptionSheet({
  visible,
  title,
  options,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  return (
    <RedesignSheet visible={visible} title={title} onClose={onClose}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          testID={`settings-option-${opt.value}`}
          accessibilityRole="button"
          onPress={() => onPick(opt.value)}
          style={{ minHeight: tokens.density.touch.minTarget, justifyContent: 'center' }}
        >
          <RedesignText>{opt.label}</RedesignText>
        </Pressable>
      ))}
    </RedesignSheet>
  );
}

function GeneralSection() {
  const { user, setUser } = useAuth();
  const { choice, setChoice, privacy, setPrivacy } = useDesign();
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? '');

  const currency = snapshot?.settings.currency ?? 'NGN';
  const weekStart = snapshot?.settings.weekStart ?? 'monday';

  const saveSettings = async (patch: Record<string, unknown>) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, ...patch });
    toast.show(t('common.saved'));
  };

  return (
    <>
      <Card testID="settings-general">
        <PickerRow
          testID="settings-language"
          label={t('settings.redesign.language')}
          value={t('settings.redesign.languageEnglish')}
          onPress={() => undefined}
        />
        <PickerRow
          testID="settings-currency"
          label={t('settings.redesign.currency')}
          value={
            currency === 'USD'
              ? t('settings.redesign.currencyUsd')
              : currency === 'GBP'
                ? t('settings.redesign.currencyGbp')
                : t('settings.redesign.currencyNgn')
          }
          onPress={() => setCurrencyOpen(true)}
        />
        <PickerRow
          testID="settings-number-format"
          label={t('settings.redesign.numberFormat')}
          value={t('settings.redesign.numberFormatNg')}
          onPress={() => undefined}
        />
        <PickerRow
          testID="settings-date-format"
          label={t('settings.redesign.dateFormat')}
          value={t('settings.redesign.dateFormatExample')}
          onPress={() => undefined}
        />
        <PickerRow
          testID="settings-week-start"
          label={t('settings.redesign.weekStarts')}
          value={weekStart === 'sunday' ? t('settings.redesign.sunday') : t('settings.redesign.monday')}
          onPress={() => setWeekOpen(true)}
        />
        <PickerRow
          testID="settings-theme"
          label={t('settings.redesign.theme')}
          value={
            choice === 'dark'
              ? t('settings.redesign.themeDark')
              : choice === 'light'
                ? t('settings.redesign.themeLight')
                : t('settings.redesign.themeSystem')
          }
          onPress={() => setThemeOpen(true)}
        />
        <RedesignSwitch
          testID="settings-hide-amounts"
          label={t('settings.redesign.hideAmounts')}
          value={privacy}
          onChange={setPrivacy}
        />
        <RedesignField
          testID="settings-name"
          label={t('settings.general.name')}
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => {
            const next = name.trim();
            if (user && next && next !== user.name) {
              setUser({ ...user, name: next });
              toast.show(t('settings.profile.saved'));
            }
          }}
        />
      </Card>
      <OptionSheet
        visible={currencyOpen}
        title={t('settings.redesign.currency')}
        options={[
          { value: 'NGN', label: t('settings.redesign.currencyNgn') },
          { value: 'USD', label: t('settings.redesign.currencyUsd') },
          { value: 'GBP', label: t('settings.redesign.currencyGbp') },
        ]}
        onClose={() => setCurrencyOpen(false)}
        onPick={(v) => {
          setCurrencyOpen(false);
          void saveSettings({ currency: v });
        }}
      />
      <OptionSheet
        visible={weekOpen}
        title={t('settings.redesign.weekStarts')}
        options={[
          { value: 'monday', label: t('settings.redesign.monday') },
          { value: 'sunday', label: t('settings.redesign.sunday') },
        ]}
        onClose={() => setWeekOpen(false)}
        onPick={(v) => {
          setWeekOpen(false);
          void saveSettings({ weekStart: v });
        }}
      />
      <OptionSheet
        visible={themeOpen}
        title={t('settings.redesign.theme')}
        options={[
          { value: 'system', label: t('settings.redesign.themeSystem') },
          { value: 'light', label: t('settings.redesign.themeLight') },
          { value: 'dark', label: t('settings.redesign.themeDark') },
        ]}
        onClose={() => setThemeOpen(false)}
        onPick={(v) => {
          setThemeOpen(false);
          setChoice(v as 'system' | 'light' | 'dark');
          toast.show(t('common.saved'));
        }}
      />
    </>
  );
}

function BudgetSection() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [styleOpen, setStyleOpen] = useState(false);
  const style = snapshot?.settings.budgetStyle ?? 'tracking';
  const carry = snapshot?.settings.carryOverDefault ?? true;
  const [warn, setWarn] = useState(true);
  const [warnAt] = useState(90);

  const save = async (patch: Record<string, unknown>) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, ...patch });
    toast.show(t('common.saved'));
  };

  return (
    <Card testID="settings-budget">
      <PickerRow
        testID="settings-budget-style"
        label={t('settings.redesign.budgetStyle')}
        value={
          style === 'envelope' ? t('settings.redesign.budgetEnvelope') : t('settings.redesign.budgetTracking')
        }
        onPress={() => setStyleOpen(true)}
      />
      <PickerRow
        testID="settings-month-starts"
        label={t('settings.redesign.monthStarts')}
        value={t('settings.redesign.monthStartsDay')}
        onPress={() => undefined}
      />
      <RedesignSwitch
        testID="settings-carry-over"
        label={t('settings.redesign.carryLeftover')}
        value={carry}
        onChange={(v) => void save({ carryOverDefault: v })}
      />
      <RedesignSwitch
        testID="settings-budget-warn"
        label={t('settings.redesign.warnClose')}
        value={warn}
        onChange={setWarn}
      />
      <PickerRow
        testID="settings-warn-at"
        label={t('settings.redesign.warnAt')}
        value={t('settings.redesign.warnAtValue', { pct: warnAt })}
        onPress={() => undefined}
      />
      <OptionSheet
        visible={styleOpen}
        title={t('settings.redesign.budgetStyle')}
        options={[
          { value: 'tracking', label: t('settings.redesign.budgetTracking') },
          { value: 'envelope', label: t('settings.redesign.budgetEnvelope') },
        ]}
        onClose={() => setStyleOpen(false)}
        onPick={(v) => {
          setStyleOpen(false);
          void save({ budgetStyle: v });
        }}
      />
    </Card>
  );
}

function CategoriesSection() {
  const { snapshot } = useWorkspace();
  const groups = useMemo(() => {
    const cats = (snapshot?.categories ?? []).filter((c) => !c.hidden && c.kind === 'expense');
    const byGroup = new Map<string, typeof cats>();
    for (const c of cats) {
      const g = c.group || 'other';
      const list = byGroup.get(g) ?? [];
      list.push(c);
      byGroup.set(g, list);
    }
    return [...byGroup.entries()];
  }, [snapshot]);

  return (
    <View testID="settings-categories" style={{ gap: sp.lg }}>
      {groups.length === 0 ? (
        <Card>
          <RedesignText tone="textSecondary">{t('settings.redesign.noCategories')}</RedesignText>
        </Card>
      ) : (
        groups.map(([group, cats]) => (
          <View key={group} style={{ gap: sp.sm }}>
            <RedesignText variant="helper" tone="textSecondary">
              {group.replace(/^group\./, '')}
            </RedesignText>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                paddingVertical: sp.xs,
              }}
            >
              {cats.map((c) => (
                <RedesignListRow key={c.id} testID={`settings-category-${c.id}`} title={c.name} onPress={() => undefined} />
              ))}
            </View>
          </View>
        ))
      )}
      <RedesignButton testID="settings-add-category" label={t('settings.redesign.addCategory')} onPress={() => undefined} fullWidth />
      <RedesignButton testID="settings-show-hidden" kind="link" label={t('settings.redesign.showHidden')} onPress={() => undefined} />
    </View>
  );
}

function NotificationsSection() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...snapshot?.settings.notificationPrefs };
  const [tips, setTips] = useState(true);
  const [moneyIn, setMoneyIn] = useState(true);
  const save = async (patch: Partial<typeof prefs>) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, notificationPrefs: { ...prefs, ...patch } });
    toast.show(t('common.saved'));
  };
  return (
    <Card testID="settings-notifications">
      <RedesignSwitch
        testID="settings-notif-bills"
        label={t('settings.redesign.notifBills')}
        value={prefs.bills}
        onChange={(v) => void save({ bills: v })}
      />
      <RedesignSwitch
        testID="settings-notif-over"
        label={t('settings.redesign.notifOverPlan')}
        value={prefs.budgetOver}
        onChange={(v) => void save({ budgetOver: v })}
      />
      <RedesignSwitch
        testID="settings-notif-money-in"
        label={t('settings.redesign.notifMoneyIn', { amount: formatNaira(5_000_000n) })}
        value={moneyIn}
        onChange={setMoneyIn}
      />
      <RedesignSwitch
        testID="settings-notif-weekly"
        label={t('settings.redesign.notifWeekly')}
        value={prefs.weeklySummary}
        onChange={(v) => void save({ weeklySummary: v })}
      />
      <RedesignSwitch
        testID="settings-notif-tips"
        label={t('settings.redesign.notifTips')}
        value={tips}
        onChange={setTips}
      />
      <PickerRow
        testID="settings-quiet-hours"
        label={t('settings.redesign.quietHours')}
        value={t('settings.redesign.quietHoursValue')}
        onPress={() => undefined}
      />
    </Card>
  );
}

function SecuritySection() {
  const lock = useAppLockSetting();
  const [afterOpen, setAfterOpen] = useState(false);
  const [biometrics, setBiometrics] = useState(true);
  return (
    <View testID="settings-security" style={{ gap: sp.lg }}>
      <Card>
        <RedesignSwitch
          testID="settings-lock-app"
          label={t('settings.redesign.lockApp')}
          value={lock.enabled}
          onChange={(v) => void lock.setEnabled(v)}
        />
        <PickerRow
          testID="settings-lock-after"
          label={t('settings.redesign.lockAfter')}
          value={lockAfterLabel(lock.afterMs)}
          onPress={() => setAfterOpen(true)}
        />
        <RedesignSwitch
          testID="settings-biometrics"
          label={t('settings.redesign.useBiometrics')}
          value={biometrics}
          onChange={setBiometrics}
        />
      </Card>
      <View style={{ gap: sp.sm }}>
        <RedesignText variant="helper" tone="textSecondary">
          {t('settings.redesign.signIn')}
        </RedesignText>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            paddingVertical: sp.xs,
          }}
        >
          <RedesignListRow
            title={t('settings.redesign.changePassword')}
            subtitle={t('settings.redesign.changePasswordHint')}
            onPress={() => undefined}
            testID="settings-change-password"
          />
          <RedesignListRow
            title={t('settings.redesign.twoStep')}
            subtitle={t('settings.redesign.twoStepHint')}
            onPress={() => undefined}
            testID="settings-two-step"
          />
          <RedesignListRow
            title={t('settings.redesign.signedInDevices')}
            subtitle={t('settings.redesign.signedInDevicesHint')}
            onPress={() => undefined}
            testID="settings-signed-devices"
          />
        </View>
      </View>
      {/* Keep deep security sheets available for flows not yet rebuilt. */}
      <View style={{ opacity: 0, height: 0, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
        <SecurityTabDeep />
      </View>
      <OptionSheet
        visible={afterOpen}
        title={t('settings.redesign.lockAfter')}
        options={LOCK_AFTER_OPTIONS.map((ms) => ({ value: String(ms), label: lockAfterLabel(ms) }))}
        onClose={() => setAfterOpen(false)}
        onPick={(v) => {
          setAfterOpen(false);
          void lock.setAfterMs(Number(v) as LockAfterMs);
        }}
      />
    </View>
  );
}

function DevicesSection() {
  return (
    <View testID="settings-devices" style={{ gap: sp.lg }}>
      <DevicesTab />
      <RedesignButton
        testID="settings-sign-out-others"
        label={t('settings.redesign.signOutOthers')}
        onPress={() => undefined}
        fullWidth
      />
    </View>
  );
}

function BanksSection() {
  return (
    <View testID="settings-banks" style={{ gap: sp.lg }}>
      <BanksTab />
      <RedesignText variant="helper" tone="textSecondary">
        {t('settings.redesign.banksTrust')}
      </RedesignText>
    </View>
  );
}

function ImportExportSection() {
  const router = useRouter();
  return (
    <View
      testID="settings-importExport"
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        paddingVertical: sp.xs,
      }}
    >
      <RedesignListRow
        testID="settings-import-file"
        title={t('settings.redesign.importFile')}
        onPress={() => router.push('/accounts')}
      />
      <RedesignListRow testID="settings-export" title={t('settings.redesign.exportEverything')} onPress={() => undefined} />
      <RedesignListRow testID="settings-backup" title={t('settings.redesign.backupNow')} onPress={() => undefined} />
      <RedesignListRow testID="settings-restore" title={t('settings.redesign.restoreBackup')} onPress={() => undefined} />
    </View>
  );
}

function CurrenciesSection() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const main = snapshot?.settings.currency ?? 'NGN';
  const daily = snapshot?.settings.downloadDailyRates ?? true;
  return (
    <View testID="settings-currencies" style={{ gap: sp.lg }}>
      <Card>
        <PickerRow testID="settings-main-currency" label={t('settings.redesign.mainCurrency')} value={main} onPress={() => undefined} />
      </Card>
      <View style={{ gap: sp.sm }}>
        <RedesignText variant="helper" tone="textSecondary">
          {t('settings.redesign.otherCurrencies')}
        </RedesignText>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            paddingVertical: sp.xs,
          }}
        >
          <RedesignListRow title={t('settings.redesign.usd')} onPress={() => undefined} />
          <RedesignListRow title={t('settings.redesign.gbp')} onPress={() => undefined} />
        </View>
      </View>
      <RedesignSwitch
        testID="settings-daily-rates"
        label={t('settings.redesign.updateRates')}
        value={daily}
        onChange={(v) => {
          if (!snapshot) return;
          void repo.updateSettings({ ...snapshot.settings, downloadDailyRates: v }).then(() => toast.show(t('common.saved')));
        }}
      />
      <RedesignButton testID="settings-add-currency" label={t('settings.redesign.addCurrency')} onPress={() => undefined} fullWidth />
    </View>
  );
}

function WorkspaceSection() {
  return (
    <View testID="settings-workspace" style={{ gap: sp.lg }}>
      <WorkspaceTabDeep />
    </View>
  );
}

function AiSection() {
  return (
    <View testID="settings-ai" style={{ gap: sp.lg }}>
      <AiTab />
      <RedesignText variant="helper" tone="textSecondary">
        {t('settings.redesign.aiFootnote')}
      </RedesignText>
    </View>
  );
}

function AdvancedSection() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showKobo, setShowKobo] = useState(true);
  void snapshot;
  void repo;

  return (
    <View testID="settings-advanced" style={{ gap: sp.lg }}>
      <Card>
        <RedesignSwitch
          testID="settings-show-kobo"
          label={t('settings.redesign.showKobo')}
          value={showKobo}
          onChange={setShowKobo}
        />
        <PickerRow
          testID="settings-reports-start"
          label={t('settings.redesign.reportsStart')}
          value={t('settings.redesign.reportsStartValue')}
          onPress={() => undefined}
        />
      </Card>
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          paddingVertical: sp.xs,
        }}
      >
        <RedesignListRow
          testID="settings-clear-local"
          title={t('settings.redesign.clearLocal')}
          subtitle={t('settings.redesign.clearLocalHint')}
          onPress={() => undefined}
        />
        <RedesignListRow
          testID="settings-delete-all"
          title={t('settings.redesign.deleteAll')}
          subtitle={t('settings.redesign.deleteAllHint')}
          onPress={() => setDeleteOpen(true)}
        />
      </View>
      <RedesignDialog
        visible={deleteOpen}
        title={t('settings.redesign.deleteTitle')}
        body={t('settings.redesign.deleteBody')}
        confirmLabel={t('settings.redesign.deleteConfirm')}
        onCancel={() => {
          setDeleteOpen(false);
          setConfirmText('');
        }}
        onConfirm={() => {
          if (confirmText.trim().toUpperCase() !== 'DELETE') return;
          setDeleteOpen(false);
          setConfirmText('');
          toast.show(t('settings.redesign.deleteQueued'));
        }}
        destructive
      />
      {deleteOpen ? (
        <View style={{ marginTop: -sp.lg }}>
          <RedesignField
            testID="settings-delete-confirm"
            label={t('settings.redesign.typeDelete')}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
          />
        </View>
      ) : null}
    </View>
  );
}

function HelpSection() {
  return (
    <View testID="settings-help" style={{ gap: sp.lg }}>
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          paddingVertical: sp.xs,
        }}
      >
        <RedesignListRow testID="settings-help-centre" title={t('settings.redesign.helpCentre')} onPress={() => undefined} />
        <RedesignListRow testID="settings-contact" title={t('settings.redesign.contactSupport')} onPress={() => undefined} />
        <RedesignListRow testID="settings-report" title={t('settings.redesign.reportProblem')} onPress={() => undefined} />
        <RedesignListRow testID="settings-idea" title={t('settings.redesign.suggestIdea')} onPress={() => undefined} />
        <RedesignListRow testID="settings-terms" title={t('settings.redesign.terms')} onPress={() => undefined} />
        <RedesignListRow testID="settings-privacy" title={t('settings.redesign.privacy')} onPress={() => undefined} />
      </View>
      <View style={{ opacity: 0, height: 0, overflow: 'hidden' }}>
        <HelpTab />
      </View>
    </View>
  );
}
