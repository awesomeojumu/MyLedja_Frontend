import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { v7 as uuidv7 } from 'uuid';
import { Check, Plus, Trash2, ShieldCheck, PiggyBank, TrendingUp, LifeBuoy } from 'lucide-react-native';

import { useTheme, TextInput, Button, Dropdown, CurrencyInput } from '../../design';
import { t } from '../../i18n';
import { formatNaira, parseAmount, toWire } from '../../money';
import { authApi, type SetupBody } from '../../api/auth';
import { NetworkError } from '../../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useSync } from '../../data/sync/SyncProvider';
import { WorkspaceRepository } from '../../data/workspace/repository';
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY, type CategoryDefinition } from '../../data/categoriesTaxonomy';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { SAVE_OR_INVEST_TAXONOMY_ID } from '../categories/catalog';
import { AddAccountSheet, type NewAccount } from '../accounts/AddAccountSheet';
import { PURPOSE_INFO, type AccountPurpose } from '../accounts/purpose';
import { CURRENCIES, currencyLabel } from './currencies';

type Step = 'about' | 'budget' | 'accounts' | 'categories';
const STEPS: Step[] = ['about', 'budget', 'accounts', 'categories'];
/** Dashboard "Get started" numbers for a skipped step (P04-02): 3 accounts, 4 categories, 5 budget style. */
const SKIP_NUMBER: Partial<Record<Step, number>> = { accounts: 3, categories: 4, budget: 5 };

type BudgetChoice = 'envelope' | 'limits' | 'track';
type WeekStart = SetupBody['weekStart'];
type SetupAccountType = SetupBody['accounts'][number]['type'];

const SPENDING_CHOICES = EXPENSE_TAXONOMY.filter((d) => d.id !== SAVE_OR_INVEST_TAXONOMY_ID);

const todayIso = () => new Date().toISOString().slice(0, 10);

export function WelcomeScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { user, workspaceId, client, setSession } = useAuth();
  const { store, engine } = useSync();
  const { enabledIncomeIds, enabledExpenseIds, setIncomeCategories, setExpenseCategories } = useCategoryPreferences();

  const [stepIndex, setStepIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<Step>>(new Set());

  const [workspaceName, setWorkspaceName] = useState(user?.workspaceName || t('welcome.step1.default'));
  const [currency, setCurrency] = useState('NGN');
  const [weekStart, setWeekStart] = useState<WeekStart>('monday');

  const [budgetChoice, setBudgetChoice] = useState<BudgetChoice>('limits');
  const [takeHome, setTakeHome] = useState('');

  const [accounts, setAccounts] = useState<(NewAccount & { key: string })[]>([]);
  const [sheetPurpose, setSheetPurpose] = useState<AccountPurpose | null>(null);

  const [expenseIds, setExpenseIds] = useState<string[]>(() =>
    enabledExpenseIds.filter((id) => id !== SAVE_OR_INVEST_TAXONOMY_ID),
  );
  const [incomeIds, setIncomeIds] = useState<string[]>(enabledIncomeIds);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  const currencyOptions = useMemo(
    () => CURRENCIES.map((c) => ({ label: currencyLabel(c.code), value: c.code })),
    [],
  );
  const weekOptions = [
    { label: t('welcome.day.monday'), value: 'monday' },
    { label: t('welcome.day.sunday'), value: 'sunday' },
    { label: t('welcome.day.saturday'), value: 'saturday' },
  ];

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? (list.length > 1 ? list.filter((x) => x !== id) : list) : [...list, id];

  const goNext = () => {
    setError('');
    if (isLast) void finish(skipped);
    else setStepIndex((i) => i + 1);
  };

  const skipStep = () => {
    const next = new Set(skipped).add(step);
    setSkipped(next);
    setError('');
    if (isLast) void finish(next);
    else setStepIndex((i) => i + 1);
  };

  const buildBody = (skippedSteps: Set<Step>): SetupBody => {
    const take = parseAmount(takeHome);
    const useAccounts = skippedSteps.has('accounts') ? [] : accounts;
    const spending = skippedSteps.has('categories')
      ? SPENDING_CHOICES.filter((d) => d.defaultActive)
      : SPENDING_CHOICES.filter((d) => expenseIds.includes(d.id));
    const income = skippedSteps.has('categories')
      ? INCOME_TAXONOMY.filter((d) => d.defaultActive)
      : INCOME_TAXONOMY.filter((d) => incomeIds.includes(d.id));
    return {
      workspaceName: workspaceName.trim() || t('welcome.step1.default'),
      currency,
      weekStart,
      budgetStyle: budgetChoice === 'envelope' ? 'envelope' : 'tracking',
      monthlyTakeHome:
        !skippedSteps.has('budget') && budgetChoice !== 'track' && take.ok && take.minor > 0n ? toWire(take.minor) : null,
      accounts: useAccounts.map((a) => ({
        id: uuidv7(),
        name: a.name,
        type: a.type as SetupAccountType,
        purpose: a.purpose,
        openingBalance: toWire(a.balanceMinor),
        openingDate: todayIso(),
        currency,
      })),
      categories: [
        ...spending.map((d) => ({ key: d.id, group: 'Spending', name: d.name })),
        ...income.map((d) => ({ key: d.id, group: 'Income', name: d.name })),
      ],
      skippedSteps: [...skippedSteps].map((s) => SKIP_NUMBER[s]).filter((n): n is number => n !== undefined),
    };
  };

  const finish = async (skippedSteps: Set<Step>) => {
    setSaving(true);
    setError('');
    const body = buildBody(skippedSteps);
    const wsId = workspaceId || user?.workspaceId;
    try {
      let finishedUser = user ? { ...user, setupComplete: true, workspaceName: body.workspaceName } : null;
      if (client.hasAccessToken() && wsId) {
        // The server creates the accounts, opening balances and categories; sync brings them to this device.
        const saved = await authApi(client).finishSetup(wsId, body);
        finishedUser = { ...saved, setupComplete: true };
        void engine.wake();
      } else if (wsId) {
        // Not signed in to a server (demo and tests): seed this device.
        await new WorkspaceRepository(store, engine, wsId).seedFromSetup(body);
      }
      setExpenseCategories(body.categories.filter((c) => c.group === 'Spending').map((c) => c.key));
      setIncomeCategories(body.categories.filter((c) => c.group === 'Income').map((c) => c.key));
      if (finishedUser) await setSession(finishedUser);
      router.replace('/' as never);
    } catch (err) {
      console.warn('Setup failed', err);
      setError(t('setup.failed'));
      if (!(err instanceof NetworkError)) setSkipped(skippedSteps);
    } finally {
      setSaving(false);
    }
  };

  const chip = (selected: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryLight : colors.surfaceSubtle,
          borderColor: selected ? colors.primary : colors.borderSubtle,
          borderRadius: radii.full,
        },
      ]}
    >
      {selected && <Check size={14} color={colors.primary} style={{ marginRight: 6 }} />}
      <Text
        style={{
          color: selected ? colors.primary : colors.textSecondary,
          fontFamily: typography.fonts.medium,
          fontSize: typography.sizes.sm,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const titleStyle = {
    color: colors.textPrimary,
    fontFamily: typography.fonts.semiBold,
    fontSize: typography.sizes.xxl,
  };
  const bodyStyle = {
    color: colors.textSecondary,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 22,
  };
  const sectionLabel = {
    color: colors.textPrimary,
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.md,
    marginBottom: spacing.sm,
  };
  const hint = {
    color: colors.textSecondary,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.sm,
  };

  const renderCategoryList = (defs: CategoryDefinition[], selectedIds: string[], onToggle: (id: string) => void) => {
    const visible = showAllCategories ? defs : defs.filter((d) => d.defaultActive || selectedIds.includes(d.id));
    return <View style={styles.chipGrid}>{visible.map((d) => chip(selectedIds.includes(d.id), d.name, () => onToggle(d.id), d.id))}</View>;
  };

  const budgetCards: { id: BudgetChoice; title: string; body: string }[] = [
    { id: 'limits', title: t('setup.budget.limits'), body: t('setup.budget.limitsBody') },
    { id: 'envelope', title: t('setup.budget.envelope'), body: t('setup.budget.envelopeBody') },
    { id: 'track', title: t('setup.budget.track'), body: t('setup.budget.trackBody') },
  ];

  const quickAdds: { purpose: AccountPurpose; label: string; icon: React.ReactNode }[] = [
    { purpose: 'emergency', label: t('setup.accounts.quick.emergency'), icon: <LifeBuoy size={16} color={colors.primary} /> },
    { purpose: 'savings', label: t('setup.accounts.quick.savings'), icon: <PiggyBank size={16} color={colors.primary} /> },
    { purpose: 'investment', label: t('setup.accounts.quick.investment'), icon: <TrendingUp size={16} color={colors.primary} /> },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.root, { padding: spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Progress */}
          <View style={[styles.badge, { backgroundColor: colors.primaryLight, borderRadius: radii.full, marginBottom: spacing.sm }]}>
            <ShieldCheck size={14} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary, fontFamily: typography.fonts.semiBold, marginLeft: spacing.xs }]}>
              {t('setup.stepOf', { n: stepIndex + 1, total: STEPS.length })}
            </Text>
          </View>
          <View style={[styles.progressRow, { marginBottom: spacing.xl }]} accessibilityRole="progressbar">
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.progressBar,
                  { backgroundColor: i <= stepIndex ? colors.primary : colors.borderSubtle, borderRadius: radii.full },
                ]}
              />
            ))}
          </View>

          {step === 'about' && (
            <View>
              <Text style={titleStyle}>{t('setup.about.title')}</Text>
              <Text style={bodyStyle}>{t('setup.about.body')}</Text>
              <View style={{ marginBottom: spacing.md }}>
                <TextInput
                  label={t('setup.about.name')}
                  placeholder={t('setup.about.namePlaceholder')}
                  value={workspaceName}
                  onChangeText={setWorkspaceName}
                />
              </View>
              <View style={{ marginBottom: spacing.md, zIndex: 20 }}>
                <Dropdown label={t('setup.about.currency')} value={currency} options={currencyOptions} onSelect={setCurrency} />
              </View>
              <View style={{ zIndex: 10 }}>
                <Dropdown
                  label={t('setup.about.weekStart')}
                  value={weekStart}
                  options={weekOptions}
                  onSelect={(v) => setWeekStart(v as WeekStart)}
                />
              </View>
            </View>
          )}

          {step === 'budget' && (
            <View>
              <Text style={titleStyle}>{t('setup.budget.title')}</Text>
              <Text style={bodyStyle}>{t('setup.budget.body')}</Text>
              {budgetCards.map((c) => {
                const selected = budgetChoice === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setBudgetChoice(c.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.optionCard,
                      {
                        borderColor: selected ? colors.primary : colors.borderSubtle,
                        backgroundColor: selected ? colors.primaryLight : colors.surface,
                        borderRadius: radii.lg,
                        padding: spacing.md,
                        marginBottom: spacing.sm,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.body }}>
                        {c.title}
                      </Text>
                      <Text style={[hint, { marginTop: 2 }]}>{c.body}</Text>
                    </View>
                    {selected && <Check size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              {budgetChoice !== 'track' && (
                <View style={{ marginTop: spacing.md }}>
                  <CurrencyInput label={t('setup.budget.takeHome')} value={takeHome} onChangeText={setTakeHome} />
                  <Text style={[hint, { marginTop: spacing.xs }]}>{t('setup.budget.takeHomeHint')}</Text>
                </View>
              )}
            </View>
          )}

          {step === 'accounts' && (
            <View>
              <Text style={titleStyle}>{t('setup.accounts.title')}</Text>
              <Text style={bodyStyle}>{t('setup.accounts.body')}</Text>

              {accounts.length === 0 ? (
                <Text style={[hint, { marginBottom: spacing.md }]}>{t('setup.accounts.empty')}</Text>
              ) : (
                accounts.map((acc) => (
                  <View
                    key={acc.key}
                    style={[
                      styles.accountItem,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.borderSubtle,
                        borderRadius: radii.md,
                        padding: spacing.md,
                        marginBottom: spacing.sm,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>{acc.name}</Text>
                      <Text style={hint}>
                        {PURPOSE_INFO[acc.purpose].label}
                        {' · '}
                        {t('setup.accounts.opening', { amount: formatNaira(acc.balanceMinor) })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setAccounts((prev) => prev.filter((a) => a.key !== acc.key))}
                      accessibilityLabel={t('setup.accounts.remove', { name: acc.name })}
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={16} color={colors.statusDanger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <Button
                label={t('setup.accounts.add')}
                onPress={() => setSheetPurpose('operating')}
                variant="secondary"
                size="md"
                icon={<Plus size={16} color={colors.primary} />}
              />

              <View
                style={[
                  styles.saveBox,
                  { borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.lg },
                ]}
              >
                <Text style={sectionLabel}>{t('setup.accounts.saveQuestion')}</Text>
                <Text style={[hint, { marginBottom: spacing.sm }]}>{t('setup.accounts.saveHint')}</Text>
                <View style={styles.chipGrid}>
                  {quickAdds.map((q) => (
                    <TouchableOpacity
                      key={q.purpose}
                      onPress={() => setSheetPurpose(q.purpose)}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle, borderRadius: radii.full },
                      ]}
                    >
                      {q.icon}
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: typography.fonts.medium,
                          fontSize: typography.sizes.sm,
                          marginLeft: 6,
                        }}
                      >
                        {q.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 'categories' && (
            <View>
              <Text style={titleStyle}>{t('setup.categories.title')}</Text>
              <Text style={bodyStyle}>{t('setup.categories.body')}</Text>

              <View style={styles.sectionHead}>
                <Text style={sectionLabel}>{t('setup.categories.spending')}</Text>
                <Text style={hint}>{t('setup.categories.selected', { n: expenseIds.length })}</Text>
              </View>
              {renderCategoryList(SPENDING_CHOICES, expenseIds, (id) => setExpenseIds((prev) => toggle(prev, id)))}

              <View style={[styles.sectionHead, { marginTop: spacing.lg }]}>
                <Text style={sectionLabel}>{t('setup.categories.income')}</Text>
                <Text style={hint}>{t('setup.categories.selected', { n: incomeIds.length })}</Text>
              </View>
              {renderCategoryList(INCOME_TAXONOMY, incomeIds, (id) => setIncomeIds((prev) => toggle(prev, id)))}

              <TouchableOpacity onPress={() => setShowAllCategories((v) => !v)} style={{ marginTop: spacing.md }}>
                <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold }}>
                  {showAllCategories ? t('setup.categories.showFewer') : t('setup.categories.showAll')}
                </Text>
              </TouchableOpacity>
              <Text style={[hint, { marginTop: spacing.md }]}>{t('setup.categories.savingsNote')}</Text>
            </View>
          )}

          {!!error && (
            <Text style={{ color: colors.statusDanger, fontFamily: typography.fonts.medium, marginTop: spacing.lg }}>{error}</Text>
          )}

          {/* Footer */}
          <View style={[styles.footer, { marginTop: spacing.xl }]}>
            {stepIndex > 0 ? (
              <Button label={t('setup.back')} onPress={() => setStepIndex((i) => i - 1)} variant="ghost" size="md" disabled={saving} />
            ) : (
              <View />
            )}
            <View style={styles.footerRight}>
              {step !== 'about' && (
                <Button label={t('setup.skip')} onPress={skipStep} variant="ghost" size="md" disabled={saving} />
              )}
              <Button
                label={isLast ? t('setup.finish') : t('setup.next')}
                onPress={goNext}
                variant="primary"
                size="md"
                loading={saving}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <AddAccountSheet
        visible={sheetPurpose !== null}
        initialPurpose={sheetPurpose ?? 'operating'}
        onClose={() => setSheetPurpose(null)}
        onSaveAccount={(acc) => setAccounts((prev) => [...prev, { ...acc, key: `${Date.now()}-${prev.length}` }])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 620,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  saveBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
});
