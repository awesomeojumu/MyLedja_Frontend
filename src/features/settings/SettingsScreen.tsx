import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import {
  Button,
  Card,
  Checkbox,
  Confirm,
  Select,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { useSync } from '@/data/sync/SyncProvider';
import { DEFAULT_NOTIFICATION_PREFS, type Category, type NotificationPrefs } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { t, type TextKey } from '@/i18n';

import {
  AdvancedTabDeep,
  AiTab,
  BanksTab,
  BudgetTabDeep,
  CurrenciesTabDeep,
  DevicesTab,
  HelpTab,
  ImportExportTabDeep,
  SecurityTabDeep,
  TagsSection,
  WorkspaceTabDeep,
} from './SettingsTabs';
import { DeleteCategorySheet, EditCategorySheet } from './SettingsSheets';

const sp = tokens.spacing;

export type SettingsTab =
  | 'general'
  | 'ai'
  | 'budget'
  | 'categories'
  | 'currencies'
  | 'banks'
  | 'importExport'
  | 'workspace'
  | 'security'
  | 'notifications'
  | 'devices'
  | 'advanced'
  | 'help';

const TABS: { id: SettingsTab; label: TextKey }[] = [
  { id: 'general', label: 'settings.tab.general' },
  { id: 'ai', label: 'settings.tab.ai' },
  { id: 'budget', label: 'settings.tab.budget' },
  { id: 'categories', label: 'settings.tab.categories' },
  { id: 'currencies', label: 'settings.tab.currencies' },
  { id: 'banks', label: 'settings.tab.banks' },
  { id: 'importExport', label: 'settings.tab.importExport' },
  { id: 'workspace', label: 'settings.tab.workspace' },
  { id: 'security', label: 'settings.tab.security' },
  { id: 'notifications', label: 'settings.tab.notifications' },
  { id: 'devices', label: 'settings.tab.devices' },
  { id: 'advanced', label: 'settings.tab.advanced' },
  { id: 'help', label: 'settings.tab.help' },
];

function tabFromParam(raw: string | string[] | undefined): SettingsTab | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const ids: SettingsTab[] = [
    'general',
    'ai',
    'budget',
    'categories',
    'currencies',
    'banks',
    'importExport',
    'workspace',
    'security',
    'notifications',
    'devices',
    'advanced',
    'help',
  ];
  return ids.includes(v as SettingsTab) ? (v as SettingsTab) : null;
}

export function SettingsScreen() {
  const size = useSizeClass();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const paramTab = tabFromParam(params.tab);
  const phone = size === 'phone';
  const [localTab, setLocalTab] = useState<SettingsTab>('general');
  const active = phone && !paramTab ? null : (paramTab ?? localTab);

  if (phone && !paramTab) {
    return (
      <AppFrame title={t('settings.title')}>
        <ScrollView contentContainerStyle={{ gap: sp['spacing-sm'] }}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              testID={`settings-link-${tab.id}`}
              accessibilityRole="button"
              onPress={() => router.push(`/settings/${tab.id}`)}
            >
              <Card>
                <Text>{t(tab.label)}</Text>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      </AppFrame>
    );
  }

  const tab = active ?? 'general';
  const tabLabel = TABS.find((x) => x.id === tab)!.label;

  return (
    <AppFrame title={t('settings.title')}>
      <View style={{ flexDirection: phone ? 'column' : 'row', gap: sp['spacing-lg'], flex: 1 }}>
        {phone ? (
          <Pressable
            testID="settings-back"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.push('/settings')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'], minHeight: 44 }}
          >
            <ChevronLeft size={20} color={theme.text} />
            <Text>{t(tabLabel)}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 220, gap: sp['spacing-xs'] }}>
            {TABS.map((item) => (
              <Pressable
                key={item.id}
                testID={`settings-tab-${item.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.id }}
                onPress={() => setLocalTab(item.id)}
                style={{
                  padding: sp['spacing-md'],
                  borderRadius: tokens.radius['rounded-md'],
                  backgroundColor: tab === item.id ? theme.hover : undefined,
                }}
              >
                <Text tone={tab === item.id ? undefined : 'textSecondary'}>{t(item.label)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flex: 1, maxWidth: phone ? undefined : 720 }}>
          {tab === 'general' ? <GeneralTab /> : null}
          {tab === 'ai' ? <AiTab /> : null}
          {tab === 'budget' ? <BudgetTabDeep /> : null}
          {tab === 'categories' ? <CategoriesTab /> : null}
          {tab === 'currencies' ? <CurrenciesTabDeep /> : null}
          {tab === 'banks' ? <BanksTab /> : null}
          {tab === 'importExport' ? <ImportExportTabDeep /> : null}
          {tab === 'workspace' ? <WorkspaceTabDeep /> : null}
          {tab === 'security' ? <SecurityTabDeep /> : null}
          {tab === 'notifications' ? <NotificationsTab /> : null}
          {tab === 'devices' ? <DevicesTab /> : null}
          {tab === 'advanced' ? <AdvancedTabDeep /> : null}
          {tab === 'help' ? <HelpTab /> : null}
        </View>
      </View>
    </AppFrame>
  );
}

function GeneralTab() {
  const { user, setUser, signOut } = useAuth();
  const { choice, setChoice } = useDesign();
  const { snapshot, repo } = useWorkspace();
  const { store } = useSync();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? '');
  const [signOutWarn, setSignOutWarn] = useState<{ count: number } | null>(null);

  const savePrefs = async () => {
    if (!snapshot) return;
    if (user && name.trim() && name.trim() !== user.name) {
      setUser({ ...user, name: name.trim() });
    }
    await repo.updateSettings({ ...snapshot.settings });
    toast.show(t('common.saved'));
  };

  const doSignOut = async () => {
    setSignOutWarn(null);
    await signOut();
    router.replace('/sign-in');
  };

  const requestSignOut = async () => {
    const waiting = (await store.outbox()).filter((o) => o.state === 'queued').length;
    if (waiting > 0) {
      setSignOutWarn({ count: waiting });
      return;
    }
    await doSignOut();
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
      <TextInput testID="settings-name" label={t('settings.general.name')} value={name} onChangeText={setName} />
      <Select
        testID="settings-language"
        label={t('settings.general.language')}
        value="en"
        onChange={() => {}}
        options={[{ value: 'en', label: t('settings.general.languageEn') }]}
      />
      <Select
        testID="settings-currency"
        label={t('settings.general.currency')}
        value={snapshot?.settings.currency ?? 'NGN'}
        onChange={(currency) => snapshot && void repo.updateSettings({ ...snapshot.settings, currency })}
        options={[{ value: 'NGN', label: 'NGN' }]}
      />
      <Select
        testID="settings-weekStart"
        label={t('settings.general.weekStart')}
        value={snapshot?.settings.weekStart ?? 'monday'}
        onChange={(weekStart) =>
          snapshot && void repo.updateSettings({ ...snapshot.settings, weekStart: weekStart as 'monday' | 'sunday' | 'saturday' })
        }
        options={[
          { value: 'monday', label: t('settings.general.weekMonday') },
          { value: 'sunday', label: t('settings.general.weekSunday') },
          { value: 'saturday', label: t('settings.general.weekSaturday') },
        ]}
      />
      <Select
        testID="settings-theme"
        label={t('settings.general.theme')}
        value={choice}
        onChange={(v) => setChoice(v as 'system' | 'light' | 'dark')}
        options={[
          { value: 'system', label: t('settings.general.themeSystem') },
          { value: 'light', label: t('settings.general.themeLight') },
          { value: 'dark', label: t('settings.general.themeDark') },
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('settings.general.haptics')}</Text>
        <Switch testID="settings-haptics" label={t('settings.general.hapticsPhone')} value={false} onChange={() => {}} disabled />
      </View>
      <Button testID="settings-save-general" label={t('panel.save')} onPress={() => void savePrefs()} />
      <Button testID="settings-sign-out" kind="secondary" label={t('nav.signOut')} onPress={() => void requestSignOut()} />
      <Confirm
        visible={signOutWarn !== null}
        title={t('sync.signOutWarnTitle')}
        body={t('sync.signOutWarnBody', { count: signOutWarn?.count ?? 0 })}
        confirmLabel={t('sync.signOutAnyway')}
        onCancel={() => setSignOutWarn(null)}
        onConfirm={() => void doSignOut()}
      />
    </ScrollView>
  );
}

function CategoriesTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const expense = useMemo(() => snapshot?.categories.filter((c) => c.kind === 'expense') ?? [], [snapshot]);

  const saveCategory = async (category: Category) => {
    await repo.updateCategory(category);
    toast.show(t('common.saved'));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
      {expense.map((c) => (
        <Card key={c.id} style={{ gap: sp['spacing-sm'] }} testID={`settings-cat-${c.id}`}>
          <Text variant="heading-sm">{c.name}</Text>
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
            <Button testID={`settings-cat-edit-${c.id}`} kind="secondary" label={t('settings.categories.edit')} onPress={() => setEditCat(c)} />
            <Button testID={`settings-cat-delete-${c.id}`} kind="secondary" label={t('settings.categories.delete')} onPress={() => setDeleteCat(c)} />
            <Button testID={`settings-cat-up-${c.id}`} kind="secondary" label={t('settings.categories.moveUp')} onPress={() => void repo.reorderCategory(c.id, 'up')} />
            <Button testID={`settings-cat-down-${c.id}`} kind="secondary" label={t('settings.categories.moveDown')} onPress={() => void repo.reorderCategory(c.id, 'down')} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text>{t('settings.categories.hidden')}</Text>
            <Switch testID={`settings-cat-hidden-${c.id}`} label={t('settings.categories.hidden')} value={c.hidden} onChange={(hidden) => void saveCategory({ ...c, hidden })} />
          </View>
        </Card>
      ))}
      <TextInput testID="settings-new-category" label={t('settings.categories.add')} value={newName} onChangeText={setNewName} />
      <Button
        testID="settings-add-category"
        label={t('settings.categories.addButton')}
        disabled={!newName.trim()}
        onPress={async () => {
          await repo.addCategory({ name: newName.trim(), kind: 'expense', group: 'group.home' });
          setNewName('');
          toast.show(t('common.saved'));
        }}
      />
      <TagsSection />
      <EditCategorySheet category={editCat} visible={editCat !== null} onClose={() => setEditCat(null)} onSave={saveCategory} />
      <DeleteCategorySheet
        category={deleteCat}
        visible={deleteCat !== null}
        onClose={() => setDeleteCat(null)}
        onConfirm={async () => {
          if (!deleteCat || !snapshot) return;
          const fallback = snapshot.categories.find((c) => c.kind === 'expense' && c.id !== deleteCat.id);
          if (!fallback) return;
          await repo.deleteCategory(deleteCat.id, fallback.id, today());
          toast.show(t('common.saved'));
        }}
      />
    </ScrollView>
  );
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
}

function NotificationsTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const prefs = snapshot?.settings.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;

  const save = async (next: typeof prefs) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, notificationPrefs: next });
    toast.show(t('common.saved'));
  };

  const toggleReminderDay = (day: number, on: boolean) => {
    const set = new Set(prefs.billReminderDays);
    if (on) set.add(day);
    else set.delete(day);
    void save({ ...prefs, billReminderDays: [...set].sort((a, b) => a - b) });
  };

  const reminderLabel = (days: number) =>
    days === 1 ? t('settings.notifications.remindDaysBefore', { days: String(days) }) : t('settings.notifications.remindDaysBeforePlural', { days: String(days) });

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-notifications">
      <Text tone="textSecondary">{t('settings.notifications.intro')}</Text>
      <Switch testID="settings-notify-bills" label={t('settings.notifications.bills')} value={prefs.bills} onChange={(bills) => void save({ ...prefs, bills })} />
      {prefs.bills ? (
        <View style={{ gap: sp['spacing-sm'], paddingLeft: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('settings.notifications.billReminders')}</Text>
          {[1, 3, 7].map((day) => (
            <Checkbox
              key={day}
              testID={`settings-notify-bill-day-${day}`}
              label={reminderLabel(day)}
              checked={prefs.billReminderDays.includes(day)}
              onChange={(checked) => toggleReminderDay(day, checked)}
            />
          ))}
        </View>
      ) : null}
      <Switch testID="settings-notify-budget" label={t('settings.notifications.budget')} value={prefs.budget} onChange={(budget) => void save({ ...prefs, budget })} />
      <Switch testID="settings-notify-goals" label={t('settings.notifications.goals')} value={prefs.goals} onChange={(goals) => void save({ ...prefs, goals })} />
      <Switch testID="settings-notify-debts" label={t('settings.notifications.debts')} value={prefs.debts} onChange={(debts) => void save({ ...prefs, debts })} />
      <Switch testID="settings-notify-income" label={t('settings.notifications.income')} value={prefs.income} onChange={(income) => void save({ ...prefs, income })} />
      <Switch
        testID="settings-notify-weekly"
        label={t('settings.notifications.weeklySummary')}
        value={prefs.weeklySummary}
        onChange={(weeklySummary) => void save({ ...prefs, weeklySummary })}
      />
      <Text variant="heading-sm">{t('settings.notifications.quietHours')}</Text>
      <View style={{ flexDirection: 'row', gap: sp['spacing-md'] }}>
        <TextInput
          testID="settings-notify-quiet-start"
          label={t('settings.notifications.quietStart')}
          value={prefs.quietHoursStart ?? ''}
          onChangeText={(quietHoursStart) => void save({ ...prefs, quietHoursStart: quietHoursStart.trim() || undefined })}
          placeholder="22:00"
        />
        <TextInput
          testID="settings-notify-quiet-end"
          label={t('settings.notifications.quietEnd')}
          value={prefs.quietHoursEnd ?? ''}
          onChangeText={(quietHoursEnd) => void save({ ...prefs, quietHoursEnd: quietHoursEnd.trim() || undefined })}
          placeholder="07:00"
        />
      </View>
      <Switch
        testID="settings-notify-hide-amounts"
        label={t('settings.notifications.hideAmounts')}
        value={prefs.hideAmountsOnLockScreen}
        onChange={(hideAmountsOnLockScreen) => void save({ ...prefs, hideAmountsOnLockScreen })}
      />
      <Text variant="caption" tone="textSecondary">
        {t('settings.notifications.quietHoursHint')}
      </Text>
    </ScrollView>
  );
}
