import { useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, GripVertical } from 'lucide-react-native';
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
import { parseTags } from '@/features/transactions/tags';
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
import { ChangeEmailSheet, useRecheck } from './SecuritySheets';
import { isRedesignEnabled } from '@/design/redesign';
import { RedesignSettingsScreen } from './RedesignSettingsScreen';
import { settingsTabShipped, type SettingsTabId } from './shipped';

const sp = tokens.spacing;

export type SettingsTab = SettingsTabId;

/** Phase when the tab ships (TB11-1). Currencies/Advanced wait for Phase 5 / later. */
const TAB_PHASE: Record<SettingsTab, number> = {
  general: 1,
  budget: 1,
  categories: 1,
  importExport: 1,
  help: 1,
  notifications: 2,
  security: 3,
  devices: 3,
  workspace: 3,
  ai: 4,
  banks: 4,
  currencies: 5,
  advanced: 99,
};

const SHIPPED_PHASE = 5;

const ALL_TABS: { id: SettingsTab; label: TextKey }[] = [
  { id: 'general', label: 'settings.tab.general' },
  { id: 'budget', label: 'settings.tab.budget' },
  { id: 'categories', label: 'settings.tab.categories' },
  { id: 'notifications', label: 'settings.tab.notifications' },
  { id: 'security', label: 'settings.tab.security' },
  { id: 'importExport', label: 'settings.tab.importExport' },
  { id: 'devices', label: 'settings.tab.devices' },
  { id: 'workspace', label: 'settings.tab.workspace' },
  { id: 'ai', label: 'settings.tab.ai' },
  { id: 'banks', label: 'settings.tab.banks' },
  { id: 'currencies', label: 'settings.tab.currencies' },
  { id: 'advanced', label: 'settings.tab.advanced' },
  { id: 'help', label: 'settings.tab.help' },
];
const TABS = ALL_TABS.filter((tab) => TAB_PHASE[tab.id] <= SHIPPED_PHASE);

/** Accept addendum aliases: data → importExport, sync → devices (TB-11). */
function tabFromParam(raw: string | string[] | undefined): SettingsTab | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  // Addendum aliases: ?tab=sync → devices, ?tab=data → importExport
  const alias: Record<string, SettingsTab> = { sync: 'devices', data: 'importExport' };
  const id = (alias[v] ?? v) as SettingsTab;
  return TABS.some((t) => t.id === id) && settingsTabShipped(id) ? id : null;
}

export function SettingsScreen() {
  if (isRedesignEnabled()) return <RedesignSettingsScreen />;
  return <LegacySettingsScreen />;
}

function LegacySettingsScreen() {
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
    // iOS-style inset grouped list (DESIGN Page 26); Android uses the same grouped chrome.
    const inset = Platform.OS === 'ios';
    return (
      <AppFrame title={t('settings.title')}>
        <ScrollView contentContainerStyle={{ gap: inset ? 0 : sp['spacing-sm'], paddingHorizontal: inset ? sp['spacing-md'] : 0 }}>
          <View
            style={
              inset
                ? {
                    borderRadius: tokens.radius['rounded-md'],
                    overflow: 'hidden',
                    backgroundColor: theme.card,
                  }
                : { gap: sp['spacing-sm'] }
            }
          >
            {visibleTabs.map((tab, index) => (
              <Pressable
                key={tab.id}
                testID={`settings-link-${tab.id}`}
                accessibilityRole="button"
                onPress={() => router.push(`/settings/${tab.id === 'importExport' ? 'data' : tab.id === 'devices' ? 'sync' : tab.id}`)}
                style={
                  inset
                    ? {
                        paddingVertical: sp['spacing-md'],
                        paddingHorizontal: sp['spacing-md'],
                        borderBottomWidth: index < visibleTabs.length - 1 ? 1 : 0,
                        borderBottomColor: theme.border,
                        minHeight: 44,
                        justifyContent: 'center',
                      }
                    : undefined
                }
              >
                {inset ? <Text>{t(tab.label)}</Text> : <Card><Text>{t(tab.label)}</Text></Card>}
              </Pressable>
            ))}
          </View>
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
  const recheck = useRecheck();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? user?.name ?? '';
  const [emailOpen, setEmailOpen] = useState(false);
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

      <Card style={{ gap: sp['spacing-sm'] }} testID="settings-email-card">
        <Text tone="textSecondary">{user?.email ?? ''}</Text>
        <Button testID="settings-change-email" kind="secondary" label={t('settings.general.changeEmail')} onPress={() => setEmailOpen(true)} />
      </Card>

      {/* Language picker hidden while English is the only option (PU-63). */}

      {(() => {
        const budgetCurrency = snapshot?.settings.currency ?? 'NGN';
        const accountCurrencies = new Set((snapshot?.accounts ?? []).map((a) => a.currency ?? budgetCurrency));
        const currencyLocked = accountCurrencies.size > 1 || [...accountCurrencies].some((c) => c !== budgetCurrency);
        return currencyLocked ? (
          <View style={{ gap: sp['spacing-xs'] }} testID="settings-currency-locked">
            <TextInput testID="settings-currency" label={t('settings.general.currency')} value={budgetCurrency} editable={false} />
            <Text variant="caption" tone="textSecondary">
              {t('settings.general.currencyLocked')}
            </Text>
          </View>
        ) : (
          <Select
            testID="settings-currency"
            label={t('settings.general.currency')}
            value={budgetCurrency}
            onChange={(currency) => void saveSettings({ currency })}
            options={[{ value: 'NGN', label: 'NGN' }]}
          />
        );
      })()}

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
      <ChangeEmailSheet visible={emailOpen} onClose={() => setEmailOpen(false)} guard={recheck.guard} />
      {recheck.sheet}
    </ScrollView>
  );
}

function CategoriesTab() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const phone = useSizeClass() === 'phone';
  const web = Platform.OS === 'web';
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [groupDraft, setGroupDraft] = useState('');
  const [reorderMode, setReorderMode] = useState(!phone);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const expense = useMemo(() => snapshot?.categories.filter((c) => c.kind === 'expense') ?? [], [snapshot]);
  const month = monthOf(today());
  const groups = useMemo(() => {
    const fromCats = expense.map((c) => c.group);
    const extra = snapshot?.settings.extraCategoryGroups ?? [];
    return [...new Set([...fromCats, ...extra])];
  }, [expense, snapshot?.settings.extraCategoryGroups]);

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

  const addGroup = async () => {
    const name = groupDraft.trim();
    if (!name || !snapshot) return;
    const key = name.toLowerCase().startsWith('group.') ? name : `group.${name.toLowerCase().replace(/\s+/g, '')}`;
    const extra = [...new Set([...(snapshot.settings.extraCategoryGroups ?? []), key])];
    await repo.updateSettings({ ...snapshot.settings, extraCategoryGroups: extra });
    setGroupDraft('');
    toast.show(t('common.saved'));
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-categories">
      {phone ? (
        <Button
          testID="settings-categories-reorder"
          kind="secondary"
          label={reorderMode ? t('settings.categories.doneReorder') : t('settings.categories.reorder')}
          onPress={() => setReorderMode((v) => !v)}
        />
      ) : null}
      {groups.map((group) => (
        <View key={group} style={{ gap: sp['spacing-sm'] }} testID={`settings-cat-group-${group}`}>
          <Text variant="heading-sm">{group.replace(/^group\./, '')}</Text>
          {expense
            .filter((c) => c.group === group)
            .map((c) => (
              <Card key={c.id} style={{ gap: sp['spacing-sm'] }} testID={`settings-cat-${c.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'] }}>
                  {web || reorderMode ? (
                    <View accessibilityLabel={t('settings.categories.dragHandle')} testID={`settings-cat-handle-${c.id}`}>
                      <GripVertical size={18} color={tokens.color['ink-mute']} />
                    </View>
                  ) : null}
                  <Text variant="heading-sm" style={{ flex: 1 }}>
                    {c.name}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
                  <Button testID={`settings-cat-edit-${c.id}`} kind="secondary" label={t('settings.categories.edit')} onPress={() => setEditCat(c)} />
                  <Button testID={`settings-cat-delete-${c.id}`} kind="secondary" label={t('settings.categories.delete')} onPress={() => setDeleteCat(c)} />
                  {web || reorderMode ? (
                    <>
                      <Button testID={`settings-cat-up-${c.id}`} kind="secondary" label={t('settings.categories.moveUp')} onPress={() => void repo.reorderCategory(c.id, 'up')} />
                      <Button testID={`settings-cat-down-${c.id}`} kind="secondary" label={t('settings.categories.moveDown')} onPress={() => void repo.reorderCategory(c.id, 'down')} />
                    </>
                  ) : null}
                </View>
                <Switch
                  testID={`settings-cat-hidden-${c.id}`}
                  label={t('settings.categories.hidden')}
                  value={c.hidden}
                  onChange={(hidden) => void saveCategory({ ...c, hidden })}
                />
              </Card>
            ))}
        </View>
      ))}
      <TextInput testID="settings-new-category" label={t('settings.categories.add')} value={newName} onChangeText={setNewName} />
      {groups.length > 1 ? (
        <Select
          testID="settings-new-category-group"
          label={t('settings.categories.group')}
          value={newGroup || groups[0]!}
          onChange={setNewGroup}
          options={groups.map((g) => ({ value: g, label: g.replace(/^group\./, '') }))}
        />
      ) : null}
      <Button
        testID="settings-add-category"
        label={t('settings.categories.addButton')}
        disabled={!newName.trim()}
        onPress={async () => {
          await repo.addCategory({ name: newName.trim(), kind: 'expense', group: newGroup || groups[0] || 'group.home' });
          setNewName('');
          toast.show(t('category.saved'));
        }}
      />
      <TextInput testID="settings-new-group" label={t('settings.categories.addGroup')} value={groupDraft} onChangeText={setGroupDraft} />
      <Button testID="settings-add-group" kind="secondary" label={t('settings.categories.addGroup')} disabled={!groupDraft.trim()} onPress={() => void addGroup()} />
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
  const tagUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of snapshot?.events ?? []) {
      for (const tag of parseTags(ev.notes)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [snapshot?.events]);

  const countFor = (tag: WorkspaceTag) => tagUsage.get(tag.name) ?? tagUsage.get(tag.id) ?? 0;

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
            {tag.name} · {t('settings.categories.tagCount', { count: String(countFor(tag)) })}
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
        body={t('settings.categories.tagDeleteBody', { count: String(remove ? countFor(remove) : 0) })}
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
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...snapshot?.settings.notificationPrefs };
  const nativePhone = Platform.OS === 'ios' || Platform.OS === 'android';

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

  const openOsSettings = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') Linking.openSettings();
  };

  return (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} testID="settings-notifications">
      <Text tone="textSecondary">{t('settings.notifications.intro')}</Text>
      {nativePhone ? (
        <Card style={{ gap: sp['spacing-sm'] }} testID="settings-notify-os-blocked">
          <Text>{t('settings.notifications.osBlocked')}</Text>
          <Button testID="settings-notify-open-os" kind="secondary" label={t('settings.notifications.turnOnInSettings')} onPress={openOsSettings} />
        </Card>
      ) : null}
      <Switch testID="settings-notify-bills" label={t('settings.notifications.bills')} value={prefs.bills} onChange={(bills) => void save({ ...prefs, bills })} />
      {prefs.bills ? (
        <View style={{ gap: sp['spacing-sm'], paddingLeft: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('settings.notifications.billReminders')}</Text>
          {[0, 1, 3, 7].map((day) => (
            <Checkbox
              key={day}
              testID={`settings-notify-bill-day-${day}`}
              label={day === 0 ? t('settings.notifications.remindOnDay') : reminderLabel(day)}
              checked={prefs.billReminderDays.includes(day)}
              onChange={(checked) => toggleReminderDay(day, checked)}
            />
          ))}
          {Platform.OS === 'android' ? (
            <Button testID="settings-notify-channel-bills" kind="link" label={t('settings.notifications.manageChannel')} onPress={openOsSettings} />
          ) : null}
        </View>
      ) : null}
      <Switch testID="settings-notify-budget" label={t('settings.notifications.budget')} value={prefs.budget} onChange={(budget) => void save({ ...prefs, budget })} />
      {Platform.OS === 'android' ? (
        <Button testID="settings-notify-channel-budget" kind="link" label={t('settings.notifications.manageChannel')} onPress={openOsSettings} />
      ) : null}
      <Switch
        testID="settings-notify-budget-over"
        label={t('settings.notifications.budgetOver')}
        value={prefs.budgetOver}
        onChange={(budgetOver) => void save({ ...prefs, budgetOver })}
      />
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
