import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';

import { useTheme, Button, useResponsive } from '../../design';
import { t, type TextKey } from '../../i18n';
import { authApi } from '../../api/auth';
import { useAuth } from '../auth/AuthProvider';
import { useSync } from '../../data/sync/SyncProvider';
import { WorkspaceRepository } from '../../data/workspace/repository';
import { openKeyValue } from '../../data/kv';
import { INCOME_TAXONOMY } from '../../data/categoriesTaxonomy';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { useFinancialRules } from '../rules/RulesContext';
import { categoryPercentages, finishSetup, savedFramework } from './finishSetup';
import { defaultDraft, frameworkOf, toMinor, totalPercent, type SetupDraft } from './plan';
import { Hint } from './ui';
import { SpaceStep } from './steps/SpaceStep';
import { MoneyStep } from './steps/MoneyStep';
import { IncomeStep } from './steps/IncomeStep';
import { StructureStep } from './steps/StructureStep';
import { CategoriesStep } from './steps/CategoriesStep';
import { BillsStep } from './steps/BillsStep';
import { GoalsStep } from './steps/GoalsStep';
import { ReviewStep } from './steps/ReviewStep';

/** The order money moves: where it is, what comes in, how it's shared, what's fixed, what it's for, then the detail. */
export const STEPS: { key: TextKey; Component: typeof SpaceStep }[] = [
  { key: 'wiz.step.space', Component: SpaceStep },
  { key: 'wiz.step.money', Component: MoneyStep },
  { key: 'wiz.step.income', Component: IncomeStep },
  { key: 'wiz.step.structure', Component: StructureStep },
  { key: 'wiz.step.bills', Component: BillsStep },
  { key: 'wiz.step.goals', Component: GoalsStep },
  { key: 'wiz.step.categories', Component: CategoriesStep },
  { key: 'wiz.step.review', Component: ReviewStep },
];
const LAST = STEPS.length - 1;

const DRAFT_KEY = 'setup:draft_v1';
/** Where the Budget page keeps expected income per income source (BudgetScreen). */
const INCOME_BUDGETS_KEY = 'pref:budget_income_budgets_v1';

export function WelcomeScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const { user, workspaceId, client, source, setSession } = useAuth();
  const { store, engine } = useSync();
  const prefs = useCategoryPreferences();
  const rules = useFinancialRules();

  const [draft, setDraft] = useState<SetupDraft>(() =>
    defaultDraft(user?.workspaceName || t('welcome.step1.default'), prefs.enabledExpenseIds, prefs.enabledIncomeIds, prefs.enabledSubcategories),
  );
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const loaded = useRef(false);

  // Bring back what was typed last time, so closing the app halfway loses nothing.
  useEffect(() => {
    void (async () => {
      try {
        const raw = await openKeyValue('myledja').get(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as SetupDraft;
          if (saved?.version === 1) {
            setDraft((d) => ({ ...d, ...saved }));
            setRestored(true);
          }
        }
      } catch {
        // A broken draft just starts fresh.
      } finally {
        loaded.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      void openKeyValue('myledja')
        .set([[DRAFT_KEY, JSON.stringify(draft)]])
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [draft]);

  const update = (patch: Partial<SetupDraft> | ((d: SetupDraft) => Partial<SetupDraft>)) =>
    setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));

  const goTo = (step: number) => {
    setError('');
    update({ step: Math.max(0, Math.min(LAST, step)) });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const step = draft.step;
  const Step = STEPS[step]!.Component;

  /** What stops this step going on, if anything. */
  const blocker = (): string => {
    if (step === 0 && !draft.workspaceName.trim()) return t('wiz.space.nameRequired');
    if (step === 3) {
      const total = totalPercent(frameworkOf(draft));
      if (total !== 100) return t('wiz.budget.mustBe100', { n: total });
    }
    return '';
  };

  const next = () => {
    const problem = blocker();
    if (problem) {
      setError(problem);
      return;
    }
    if (step === LAST) void finish();
    else goTo(step + 1);
  };

  const skip = () => {
    update((d) => ({ skipped: [...new Set([...d.skipped, step])] }));
    goTo(step + 1);
  };

  const finish = async () => {
    const wsId = workspaceId || user?.workspaceId;
    if (!wsId) return;
    setSaving(true);
    setError('');
    try {
      const repo = new WorkspaceRepository(store, engine, wsId);
      const onServer = source !== 'mock';
      let finishedUser = user ? { ...user, setupComplete: true, workspaceName: draft.workspaceName.trim() || user.workspaceName } : null;
      const result = await finishSetup(draft, {
        repo,
        sendSetup: onServer
          ? async (body) => {
              const saved = await authApi(client).finishSetup(wsId, body);
              finishedUser = { ...saved, setupComplete: true };
            }
          : null,
        syncNow: () => engine.sync({ force: true }),
      });
      // The demo mock keeps its own record of setup too.
      if (!onServer && client.hasAccessToken()) {
        await authApi(client)
          .finishSetup(wsId, { workspaceName: draft.workspaceName, currency: draft.currency, weekStart: draft.weekStart, accounts: [], categories: [], budgetStyle: 'tracking', monthlyTakeHome: null, skippedSteps: [] })
          .catch(() => undefined);
      }

      // This device's planning settings: the structure, each category's share, and the Budget page's income.
      await rules.applyOnboardingPlan(savedFramework(draft), categoryPercentages(draft));
      prefs.setExpenseCategories(draft.expenseIds);
      prefs.setIncomeCategories(draft.incomeIds);
      prefs.setSubcategories(draft.subcategories);
      const incomeDef = INCOME_TAXONOMY.find((d) => draft.incomeIds.includes(d.id));
      const take = toMinor(draft.takeHome);
      const kv = openKeyValue('myledja');
      if (incomeDef && take > 0n) {
        await kv
          .set([[INCOME_BUDGETS_KEY, JSON.stringify({ [incomeDef.id]: { id: incomeDef.id, name: incomeDef.name, totalPlannedMinor: take.toString(), subBudgets: {} } })]])
          .catch(() => undefined);
      }
      await kv.remove([DRAFT_KEY]).catch(() => undefined);

      if (finishedUser) await setSession(finishedUser);
      if (result.failed.length > 0) {
        setNotice(t('wiz.partial', { items: result.failed.join(', ') }));
        setTimeout(() => router.replace('/' as never), 3500);
      } else {
        router.replace('/' as never);
      }
    } catch (err) {
      console.warn('Setup failed', err);
      setError(t('wiz.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView ref={scroll} contentContainerStyle={[styles.root, { padding: spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Roadmap: every step by name; done steps can be revisited. */}
          <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.sm, marginBottom: spacing.xs }}>
            {`${t('wiz.stepOf', { n: step + 1, total: STEPS.length })} · ${t(STEPS[step]!.key)}`}
          </Text>
          <View style={{ marginBottom: spacing.xl }}>
            <View style={[styles.roadmap, { gap: isDesktop ? 8 : 6 }]}>
              {STEPS.map((s, i) => {
                const done = i < step;
                const current = i === step;
                return (
                  <TouchableOpacity
                    key={s.key}
                    disabled={i > step}
                    onPress={() => goTo(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current, disabled: i > step }}
                    style={[
                      styles.roadStep,
                      {
                        borderRadius: radii.full,
                        backgroundColor: current ? colors.primary : done ? colors.primaryLight : colors.surfaceSubtle,
                      },
                    ]}
                  >
                    {done ? (
                      <Check size={12} color={colors.primary} />
                    ) : (
                      <Text style={{ color: current ? '#FFFFFF' : colors.textSecondary, fontFamily: typography.fonts.semiBold, fontSize: 11 }}>
                        {i + 1}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: current ? '#FFFFFF' : done ? colors.primary : colors.textSecondary,
                        fontFamily: typography.fonts.medium,
                        fontSize: 12,
                        marginLeft: 6,
                      }}
                    >
                      {t(s.key)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {restored && step === 0 && <Hint style={{ marginBottom: spacing.md }}>{t('wiz.draftRestored')}</Hint>}

          <Step draft={draft} update={update} goTo={goTo} />

          {!!error && (
            <Text style={{ color: colors.statusDanger, fontFamily: typography.fonts.medium, marginTop: spacing.lg }}>{error}</Text>
          )}
          {!!notice && <Hint style={{ marginTop: spacing.lg }}>{notice}</Hint>}

          <View style={[styles.footer, { marginTop: spacing.xl }]}>
            {step > 0 ? <Button label={t('wiz.back')} onPress={() => goTo(step - 1)} variant="ghost" size="md" disabled={saving} /> : <View />}
            <View style={styles.footerRight}>
              {step > 0 && step < LAST && <Button label={t('wiz.skip')} onPress={skip} variant="ghost" size="md" disabled={saving} />}
              <Button label={step === LAST ? t('wiz.finish') : t('wiz.next')} onPress={next} variant="primary" size="md" loading={saving} />
            </View>
          </View>
          {saving && (
            <View style={[styles.saving, { marginTop: spacing.md }]}>
              <ActivityIndicator color={colors.primary} />
              <Hint style={{ marginLeft: spacing.sm }}>{t('wiz.saving')}</Hint>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center' },
  card: { width: '100%', maxWidth: 680, paddingTop: 24 },
  roadmap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  roadStep: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  saving: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
