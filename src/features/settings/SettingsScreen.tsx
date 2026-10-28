import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import {
  Button,
  Card,
  Checkbox,
  SegmentedControl,
  Select,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { DEFAULT_NOTIFICATION_PREFS, type Category, type NotificationPrefs } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { t, type TextKey } from '@/i18n';

import { exportTransactionsCsv } from './export';

const sp = tokens.spacing;

export type SettingsTab = 'general' | 'budget' | 'categories' | 'importExport' | 'notifications';

const TABS: { id: SettingsTab; label: TextKey }[] = [
  { id: 'general', label: 'settings.tab.general' },
  { id: 'budget', label: 'settings.tab.budget' },
  { id: 'categories', label: 'settings.tab.categories' },
  { id: 'importExport', label: 'settings.tab.importExport' },
  { id: 'notifications', label: 'settings.tab.notifications' },
];

function tabFromParam(raw: string | string[] | undefined): SettingsTab | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'general' || v === 'budget' || v === 'categories' || v === 'importExport' || v === 'notifications') return v;
  return null;
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
          {tab === 'budget' ? <BudgetTab /> : null}
          {tab === 'categories' ? <CategoriesTab /> : null}
          {tab === 'importExport' ? <ImportExportTab /> : null}
          {tab === 'notifications' ? <NotificationsTab /> : null}
        </View>
      </View>
    </AppFrame>
  );
}

function GeneralTab() {
  const { user, setUser, signOut } = useAuth();
  const { choice, setChoice } = useDesign();
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? '');

  const savePrefs = async () => {
    if (!snapshot) return;
    if (user && name.trim() && name.trim() !== user.name) {
      setUser({ ...user, name: name.trim() });
    }
    await repo.updateSettings({ ...snapshot.settings });
    toast.show(t('common.saved'));
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
      <Button
        testID="settings-sign-out"
        kind="secondary"
        label={t('nav.signOut')}
        onPress={async () => {
          await signOut();
          router.replace('/sign-in');
        }}
      />
    </ScrollView>
  );
}

function BudgetTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const style = snapshot?.settings.budgetStyle ?? 'tracking';

  return (
    <View style={{ gap: sp['spacing-md'] }}>
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
    </View>
  );
}

function CategoriesTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const expense = useMemo(() => snapshot?.categories.filter((c) => c.kind === 'expense') ?? [], [snapshot]);

  const saveCategory = async (category: Category) => {
    await repo.updateCategory(category);
    toast.show(t('common.saved'));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
      {expense.map((c) => (
        <Card key={c.id} style={{ gap: sp['spacing-sm'] }} testID={`settings-cat-${c.id}`}>
          <TextInput
            testID={`settings-cat-name-${c.id}`}
            label={t('settings.categories.name')}
            value={c.name}
            onChangeText={(name) => void saveCategory({ ...c, name })}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text>{t('settings.categories.hidden')}</Text>
            <Switch testID={`settings-cat-hidden-${c.id}`} label={t('settings.categories.hidden')} value={c.hidden} onChange={(hidden) => void saveCategory({ ...c, hidden })} />
          </View>
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
            <Button testID={`settings-cat-up-${c.id}`} kind="secondary" label={t('settings.categories.moveUp')} onPress={() => void repo.reorderCategory(c.id, 'up')} />
            <Button testID={`settings-cat-down-${c.id}`} kind="secondary" label={t('settings.categories.moveDown')} onPress={() => void repo.reorderCategory(c.id, 'down')} />
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
      <Text variant="caption" tone="textSecondary">
        {t('settings.categories.tagsLater')}
      </Text>
    </ScrollView>
  );
}

function ImportExportTab() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const toast = useToast();

  return (
    <View style={{ gap: sp['spacing-md'] }}>
      <Text tone="textSecondary">{t('settings.importExport.importBody')}</Text>
      <Button testID="settings-go-accounts" kind="secondary" label={t('settings.importExport.goAccounts')} onPress={() => router.push('/accounts')} />
      <Text tone="textSecondary">{t('settings.importExport.exportBody')}</Text>
      <Button
        testID="settings-export-csv"
        label={t('settings.importExport.exportCsv')}
        onPress={() => {
          if (!snapshot) return;
          const csv = exportTransactionsCsv(snapshot);
          if (typeof document !== 'undefined') {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'myledja-transactions.csv';
            a.click();
            URL.revokeObjectURL(url);
          }
          toast.show(t('settings.importExport.exportDone'));
        }}
      />
    </View>
  );
}

function NotificationsTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const prefs = snapshot?.settings.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;

  const save = async (next: NotificationPrefs) => {
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
