import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { v7 as uuidv7 } from 'uuid';

import {
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
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { useSync } from '@/data/sync/SyncProvider';
import { DEFAULT_NOTIFICATION_PREFS, type Category, type WorkspaceTag } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { AccountImportSheet } from '@/features/accounts/AccountImportSheet';
import { pickImageUri } from '@/features/payees/pickMedia';
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
  WorkspaceTabDeep,
} from './SettingsTabs';
import { DeleteCategorySheet, EditCategorySheet, type CategoryDraft } from '@/features/budget/CategorySheets';
import { monthOf } from '@/ledger';
import { settingsTabShipped, type SettingsTabId } from './shipped';

const sp = tokens.spacing;

export type SettingsTab = SettingsTabId;

const TABS: { id: SettingsTab; label: TextKey }[] = [
  { id: 'general', label: 'settings.tab.general' },
  { id: 'budget', label: 'settings.tab.budget' },
  { id: 'categories', label: 'settings.tab.categories' },
  { id: 'importExport', label: 'settings.tab.importExport' },
  { id: 'notifications', label: 'settings.tab.notifications' },
  { id: 'security', label: 'settings.tab.security' },
  { id: 'devices', label: 'settings.tab.devices' },
  { id: 'workspace', label: 'settings.tab.workspace' },
  { id: 'ai', label: 'settings.tab.ai' },
  { id: 'banks', label: 'settings.tab.banks' },
  { id: 'currencies', label: 'settings.tab.currencies' },
  { id: 'advanced', label: 'settings.tab.advanced' },
  { id: 'help', label: 'settings.tab.help' },
];

/** Accept addendum aliases: data → importExport, sync → devices (TB-11). */
function tabFromParam(raw: string | string[] | undefined): SettingsTab | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const alias: Record<string, SettingsTab> = {
    data: 'importExport',
    sync: 'devices',
  };
  const id = (alias[v] ?? v) as SettingsTab;
  return TABS.some((t) => t.id === id) && settingsTabShipped(id) ? id : null;
}

export function SettingsScreen() {
  const size = useSizeClass();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const paramTab = tabFromParam(params.tab);
  const phone = size === 'phone';
  const [localTab, setLocalTab] = useState<SettingsTab>('general');
  const visibleTabs = useMemo(() => TABS.filter((tab) => settingsTabShipped(tab.id)), []);
  const active = phone && !paramTab ? null : (paramTab ?? localTab);
  const selectTab = (id: SettingsTab) => {
    setLocalTab(id);
    router.setParams({ tab: id === 'importExport' ? 'data' : id === 'devices' ? 'sync' : id });
  };

  if (phone && !paramTab) {
    return (
      <AppFrame title={t('settings.title')}>
        <ScrollView contentContainerStyle={{ gap: sp['spacing-sm'] }}>
          {visibleTabs.map((tab) => (
            <Pressable
              key={tab.id}
              testID={`settings-link-${tab.id}`}
              accessibilityRole="button"
              onPress={() => router.push(`/settings/${tab.id === 'importExport' ? 'data' : tab.id === 'devices' ? 'sync' : tab.id}`)}
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

  const tab = active && settingsTabShipped(active) ? active : 'general';
  const tabLabel = visibleTabs.find((x) => x.id === tab)?.label ?? 'settings.tab.general';

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
            {visibleTabs.map((item) => (
              <Pressable
                key={item.id}
                testID={`settings-tab-${item.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.id }}
                onPress={() => selectTab(item.id)}
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
          {tab === 'importExport' ? <ImportExportPhase1 /> : null}
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

/** PU-63 + Settings › General (TB-11 Phase 1). */
function GeneralTab() {
  const { user, setUser, signOut } = useAuth();
  const { choice, setChoice } = useDesign();
  const { snapshot, repo } = useWorkspace();
  const { store } = useSync();
  const toast = useToast();
  const router = useRouter();
  const phone = useSizeClass() === 'phone';
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? user?.name ?? '';
  const [signOutWarn, setSignOutWarn] = useState<{ count: number } | null>(null);
  const photoUri = snapshot?.settings.profilePhotoUri ?? null;
  const haptics = snapshot?.settings.hapticsEnabled ?? true;

  const saveProfileName = async () => {
    const next = name.trim();
    if (!user || !next || next === user.name) {
      setNameDraft(null);
      return;
    }
    setUser({ ...user, name: next });
    setNameDraft(null);
    toast.show(t('settings.profile.saved'));
  };

  const saveSettings = async (patch: Partial<NonNullable<typeof snapshot>['settings']>) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, ...patch });
    toast.show(t('common.saved'));
  };

  const changePhoto = async () => {
    const uri = await pickImageUri();
    if (!uri || !snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, profilePhotoUri: uri });
    toast.show(t('settings.profile.saved'));
  };

  const removePhoto = async () => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, profilePhotoUri: null });
    toast.show(t('settings.profile.saved'));
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
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-general">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
        <Pressable
          testID="settings-profile-photo"
          accessibilityRole="button"
          accessibilityLabel={t('settings.profile.changePhoto')}
          onPress={() => void changePhoto()}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: tokens.color['primary-bg-subdued-hover'],
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: 72, height: 72 }} accessibilityIgnoresInvertColors />
          ) : (
            <Text variant="heading-md">{(name || '?').slice(0, 1).toUpperCase()}</Text>
          )}
        </Pressable>
        <View style={{ gap: sp['spacing-xs'] }}>
          <Button testID="settings-photo-change" kind="link" label={t('settings.profile.changePhoto')} onPress={() => void changePhoto()} />
          {photoUri ? (
            <Button testID="settings-photo-remove" kind="link" label={t('settings.profile.removePhoto')} onPress={() => void removePhoto()} />
          ) : null}
        </View>
      </View>

      <TextInput
        testID="settings-name"
        label={t('settings.general.name')}
        value={name}
        onChangeText={setNameDraft}
        onBlur={() => void saveProfileName()}
      />

      <TextInput testID="settings-email" label={t('settings.general.email')} value={user?.email ?? ''} readOnly />
      {/* Change email is Phase 3 (PU-61); affordance listed for later workers. */}

      {/* Language picker hidden while English is the only option (PU-63). */}

      <Select
        testID="settings-currency"
        label={t('settings.general.currency')}
        value={snapshot?.settings.currency ?? 'NGN'}
        onChange={(currency) => void saveSettings({ currency })}
        options={[{ value: 'NGN', label: 'NGN' }]}
      />

      <SegmentedControl
        testID="settings-weekStart"
        label={t('settings.general.weekStart')}
        value={snapshot?.settings.weekStart ?? 'monday'}
        onChange={(weekStart) => void saveSettings({ weekStart: weekStart as 'monday' | 'sunday' | 'saturday' })}
        options={[
          { value: 'monday', label: t('settings.general.weekMonday') },
          { value: 'sunday', label: t('settings.general.weekSunday') },
          { value: 'saturday', label: t('settings.general.weekSaturday') },
        ]}
      />

      <SegmentedControl
        testID="settings-theme"
        label={t('settings.general.theme')}
        value={choice}
        onChange={(v) => {
          setChoice(v as 'system' | 'light' | 'dark');
          toast.show(t('common.saved'));
        }}
        options={[
          { value: 'system', label: t('settings.general.themeSystem') },
          { value: 'light', label: t('settings.general.themeLight') },
          { value: 'dark', label: t('settings.general.themeDark') },
        ]}
      />

      {phone || Platform.OS !== 'web' ? (
        <Switch
          testID="settings-haptics"
          label={t('settings.general.haptics')}
          value={haptics}
          onChange={(hapticsEnabled) => void saveSettings({ hapticsEnabled })}
        />
      ) : null}

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
  const month = monthOf(today());

  const saveCategory = async (category: Category) => {
    await repo.updateCategory(category);
    toast.show(t('category.saved'));
  };

  const saveDraft = async (draft: CategoryDraft) => {
    if (!editCat) return;
    await saveCategory({
      ...editCat,
      name: draft.name,
      group: draft.group,
      kind: draft.kind,
      budgetType: draft.budgetType,
      icon: draft.icon,
      essential: draft.essential,
      hidden: draft.hidden,
    });
    setEditCat(null);
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-categories">
      {expense.map((c) => (
        <Card key={c.id} style={{ gap: sp['spacing-sm'] }} testID={`settings-cat-${c.id}`}>
          <Text variant="heading-sm">{c.name}</Text>
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
            <Button testID={`settings-cat-edit-${c.id}`} kind="secondary" label={t('settings.categories.edit')} onPress={() => setEditCat(c)} />
            <Button testID={`settings-cat-delete-${c.id}`} kind="secondary" label={t('settings.categories.delete')} onPress={() => setDeleteCat(c)} />
            <Button testID={`settings-cat-up-${c.id}`} kind="secondary" label={t('settings.categories.moveUp')} onPress={() => void repo.reorderCategory(c.id, 'up')} />
            <Button testID={`settings-cat-down-${c.id}`} kind="secondary" label={t('settings.categories.moveDown')} onPress={() => void repo.reorderCategory(c.id, 'down')} />
          </View>
          <Switch
            testID={`settings-cat-hidden-${c.id}`}
            label={t('settings.categories.hidden')}
            value={c.hidden}
            onChange={(hidden) => void saveCategory({ ...c, hidden })}
          />
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
          toast.show(t('category.saved'));
        }}
      />
      <TagsSection />
      {snapshot && editCat ? (
        <EditCategorySheet
          visible
          category={editCat}
          snapshot={snapshot}
          onClose={() => setEditCat(null)}
          onSave={saveDraft}
          onDelete={() => {
            setDeleteCat(editCat);
            setEditCat(null);
          }}
        />
      ) : null}
      {snapshot && deleteCat ? (
        <DeleteCategorySheet
          visible
          category={deleteCat}
          snapshot={snapshot}
          month={month}
          onClose={() => setDeleteCat(null)}
          onConfirm={async (moveTo) => {
            const r = await repo.deleteCategory(deleteCat.id, moveTo, today());
            if (!r.ok) return;
            const undoId = r.value?.undoId;
            toast.show(t('category.deleted'), undoId ? () => void repo.undoDeleteCategory(undoId, today()) : undefined);
            setDeleteCat(null);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function TagsSection() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [rename, setRename] = useState<WorkspaceTag | null>(null);
  const [renameText, setRenameText] = useState('');
  const [remove, setRemove] = useState<WorkspaceTag | null>(null);
  const tags = snapshot?.settings.tags ?? [];

  const saveTags = async (next: WorkspaceTag[]) => {
    if (!snapshot) return;
    await repo.updateSettings({ ...snapshot.settings, tags: next });
    toast.show(t('common.saved'));
  };

  return (
    <View style={{ gap: sp['spacing-sm'] }} testID="settings-tags">
      <Text variant="heading-sm">{t('settings.categories.tagsTitle')}</Text>
      {tags.map((tag) => (
        <Card key={tag.id} style={{ gap: sp['spacing-sm'] }} testID={`settings-tag-${tag.id}`}>
          <Text>
            {tag.name} · {t('settings.categories.tagCount', { count: '0' })}
          </Text>
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
            <Button
              kind="secondary"
              label={t('settings.categories.tagsRename')}
              onPress={() => {
                setRename(tag);
                setRenameText(tag.name);
              }}
            />
            <Button kind="secondary" label={t('settings.categories.tagsDelete')} onPress={() => setRemove(tag)} />
          </View>
        </Card>
      ))}
      <TextInput testID="settings-new-tag" label={t('settings.categories.tagName')} value={name} onChangeText={setName} />
      <Button
        testID="settings-add-tag"
        label={t('settings.categories.addTag')}
        disabled={!name.trim()}
        onPress={() => {
          void saveTags([...tags, { id: uuidv7(), name: name.trim() }]);
          setName('');
        }}
      />
      <Confirm
        visible={rename !== null}
        title={t('settings.categories.tagsRename')}
        body={renameText}
        confirmLabel={t('panel.save')}
        onCancel={() => setRename(null)}
        onConfirm={() => {
          if (!rename) return;
          void saveTags(tags.map((x) => (x.id === rename.id ? { ...x, name: renameText.trim() || x.name } : x)));
          setRename(null);
        }}
      />
      {rename ? (
        <TextInput testID="settings-rename-tag" label={t('settings.categories.tagName')} value={renameText} onChangeText={setRenameText} />
      ) : null}
      <Confirm
        visible={remove !== null}
        title={t('settings.categories.tagDeleteTitle', { name: remove?.name ?? '' })}
        body={t('settings.categories.tagDeleteBody', { count: '0' })}
        confirmLabel={t('settings.categories.tagsDelete')}
        onCancel={() => setRemove(null)}
        onConfirm={() => {
          if (!remove) return;
          void saveTags(tags.filter((x) => x.id !== remove.id));
          setRemove(null);
        }}
      />
    </View>
  );
}

/** Phase 1 Import and export: CSV import into an account + CSV export (backup/delete are Phase 3). */
function ImportExportPhase1() {
  const { snapshot } = useWorkspace();
  const toast = useToast();
  const [accountId, setAccountId] = useState(snapshot?.accounts[0]?.id ?? '');
  const [importOpen, setImportOpen] = useState(false);
  const account = snapshot?.accounts.find((a) => a.id === accountId) ?? snapshot?.accounts[0];
  const options = (snapshot?.accounts ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-import-export">
      <Text tone="textSecondary">{t('settings.importExport.importBody')}</Text>
      {options.length ? (
        <Select testID="settings-import-account" label={t('settings.importExport.pickAccount')} options={options} value={accountId || options[0]!.value} onChange={setAccountId} />
      ) : null}
      <Button testID="settings-import-csv" label={t('settings.importExport.importCsv')} disabled={!account} onPress={() => setImportOpen(true)} />
      <ImportExportTabDeep />
      {importOpen && account ? (
        <AccountImportSheet
          account={account}
          onClose={() => setImportOpen(false)}
          onImported={(_id, _count) => {
            setImportOpen(false);
            toast.show(t('common.saved'));
          }}
        />
      ) : null}
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
