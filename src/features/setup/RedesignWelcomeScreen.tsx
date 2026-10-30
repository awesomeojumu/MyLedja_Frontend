import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import type { SetupBody } from '@/api/auth';
import { useSync } from '@/data/sync/SyncProvider';
import { WorkspaceRepository } from '@/data/workspace/repository';
import {
  RedesignButton,
  RedesignChoiceCard,
  RedesignChip,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignSetupFrame,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { successHaptic } from '@/features/budget/haptics';
import { t, type TextKey } from '@/i18n';
import { parseAmount, toWire } from '@/money';
import { ACCOUNT_TYPES, WEEK_STARTS, type AccountType } from './starter';
import { WelcomeInstitutionBadge } from './WelcomeInstitutionBadge';
import { fromApiInstitutions, matchInstitution, NG_INSTITUTIONS, type Institution } from './institutions';

const sp = tokens.space;
const size = tokens.size;

type Step = 'start' | 1 | 2 | 3 | 'manual' | 4 | 5 | 'done';
type AccountRow = { name: string; type: AccountType; amountText: string; minor: bigint | null };
type Audience = 'solo' | 'household';
type AccountPath = 'connect' | 'manual' | null;
type PlanStyle = 'envelope' | 'limits' | 'track';

/** Flat Figma category chips (Welcome Mobile 4:540); map to setup keys/groups. */
const REDESIGN_CATEGORIES: { key: string; group: string; labelKey: TextKey; selected: boolean }[] = [
  { key: 'cat.market', group: 'group.food', labelKey: 'welcome.redesign.cat.food', selected: true },
  { key: 'cat.fuel', group: 'group.gettingAround', labelKey: 'welcome.redesign.cat.transport', selected: true },
  { key: 'cat.rent', group: 'group.home', labelKey: 'welcome.redesign.cat.rent', selected: true },
  { key: 'cat.data', group: 'group.home', labelKey: 'welcome.redesign.cat.data', selected: true },
  { key: 'cat.electricity', group: 'group.home', labelKey: 'welcome.redesign.cat.utilities', selected: true },
  { key: 'cat.health', group: 'group.family', labelKey: 'welcome.redesign.cat.health', selected: true },
  { key: 'cat.familySupport', group: 'group.family', labelKey: 'welcome.redesign.cat.family', selected: true },
  { key: 'cat.tithe', group: 'group.faith', labelKey: 'welcome.redesign.cat.giving', selected: true },
  { key: 'cat.savings', group: 'group.home', labelKey: 'welcome.redesign.cat.savings', selected: true },
  { key: 'cat.schoolFees', group: 'group.family', labelKey: 'welcome.redesign.cat.education', selected: false },
  { key: 'cat.shopping', group: 'group.home', labelKey: 'welcome.redesign.cat.shopping', selected: false },
  { key: 'cat.entertainment', group: 'group.home', labelKey: 'welcome.redesign.cat.entertainment', selected: false },
  { key: 'cat.personalCare', group: 'group.home', labelKey: 'welcome.redesign.cat.personalCare', selected: false },
  { key: 'cat.travel', group: 'group.gettingAround', labelKey: 'welcome.redesign.cat.travel', selected: false },
];

const START_ITEMS: { titleKey: TextKey; bodyKey: TextKey }[] = [
  { titleKey: 'welcome.redesign.start.space', bodyKey: 'welcome.redesign.start.spaceBody' },
  { titleKey: 'welcome.redesign.start.money', bodyKey: 'welcome.redesign.start.moneyBody' },
  { titleKey: 'welcome.redesign.start.accounts', bodyKey: 'welcome.redesign.start.accountsBody' },
  { titleKey: 'welcome.redesign.start.categories', bodyKey: 'welcome.redesign.start.categoriesBody' },
  { titleKey: 'welcome.redesign.start.budget', bodyKey: 'welcome.redesign.start.budgetBody' },
];

function StepProgress({ step }: { step: number }) {
  return (
    <View testID="step-of" style={{ gap: sp.sm }}>
      <View style={{ flexDirection: 'row', gap: sp.xs }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: i <= step ? theme.primary : theme.border,
            }}
          />
        ))}
      </View>
      <RedesignText variant="caption" tone="textSecondary">
        {t('welcome.stepOf', { n: step })}
      </RedesignText>
    </View>
  );
}

function Footer({
  primary,
  primaryKind = 'primary',
  onPrimary,
  primaryDisabled,
  onSkip,
  onBack,
  showBack,
}: {
  primary: string;
  primaryKind?: 'primary' | 'soft';
  onPrimary: () => void;
  primaryDisabled?: boolean;
  onSkip?: () => void;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <View style={{ gap: sp.md }}>
      <RedesignButton
        testID="continue"
        kind={primaryDisabled ? 'soft' : primaryKind}
        label={primary}
        onPress={onPrimary}
        disabled={primaryDisabled}
        fullWidth
      />
      {onSkip ? (
        <RedesignButton testID="skip" kind="link" label={t('common.skip')} onPress={onSkip} accessibilityRole="link" />
      ) : null}
      {showBack && onBack ? (
        <RedesignButton testID="back" kind="link" label={t('common.back')} onPress={onBack} accessibilityRole="link" />
      ) : null}
    </View>
  );
}

/**
 * Progressive Welcome (Figma Welcome Mobile 4:271 … 4:676).
 * Start → space → money → accounts → categories → budget → done.
 */
export function RedesignWelcomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { api, user, setUser } = useAuth();
  const sync = useSync();
  const [step, setStep] = useState<Step>('start');
  const [skipped, setSkipped] = useState<number[]>([]);
  const [workspaceName, setWorkspaceName] = useState(t('welcome.step1.default'));
  const [audience, setAudience] = useState<Audience>('solo');
  const [weekStart, setWeekStart] = useState<(typeof WEEK_STARTS)[number]>('monday');
  const [accountPath, setAccountPath] = useState<AccountPath>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [draft, setDraft] = useState<AccountRow>({ name: '', type: 'bank', amountText: '', minor: null });
  const [draftError, setDraftError] = useState<string | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () => new Set(REDESIGN_CATEGORIES.filter((c) => c.selected).map((c) => c.key)),
  );
  const [custom, setCustom] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [plan, setPlan] = useState<PlanStyle>('limits');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>(NG_INSTITUTIONS);

  const goBack = useCallback(() => {
    setStep((current) => {
      if (current === 1) return 'start';
      if (current === 2) return 1;
      if (current === 3) return 2;
      if (current === 'manual') return 3;
      if (current === 4) return accountPath === 'manual' ? 'manual' : 3;
      if (current === 5) return 4;
      return current;
    });
  }, [accountPath]);

  useEffect(() => {
    let cancelled = false;
    void api
      .listInstitutions()
      .then((list) => {
        if (!cancelled && list.institutions.length) setInstitutions(fromApiInstitutions(list.institutions));
      })
      .catch(() => {
        /* offline fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'start' || step === 'done') return step === 'start';
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, goBack]);

  useEffect(() => {
    type BeforeRemove = { preventDefault: () => void };
    const nav = navigation as unknown as {
      addListener: (event: 'beforeRemove', cb: (e: BeforeRemove) => void) => () => void;
    };
    return nav.addListener('beforeRemove', (e) => {
      if (step === 'done') return;
      e.preventDefault();
      if (step !== 'start') goBack();
    });
  }, [navigation, step, goBack]);

  const markSkip = (n: number, skip: boolean) => {
    setSkipped((prev) => (skip ? [...new Set([...prev, n])] : prev.filter((x) => x !== n)));
  };

  const finish = useCallback(
    async (skip: number[]) => {
      if (!user) return;
      setBusy(true);
      setError(null);
      try {
        const categories = [
          ...REDESIGN_CATEGORIES.filter((c) => selectedCats.has(c.key)).map((c) => ({
            key: c.key,
            group: c.group,
            name: t(c.labelKey),
          })),
          ...custom.map((name) => ({ key: `custom:${name}`, group: 'custom', name })),
        ];
        const budgetStyle = plan === 'envelope' ? 'envelope' : 'tracking';
        const body: SetupBody = {
          workspaceName: skip.includes(1) ? t('welcome.step1.default') : workspaceName.trim() || t('welcome.step1.default'),
          currency: 'NGN',
          weekStart,
          accounts: skip.includes(3)
            ? []
            : accounts
                .filter((a) => a.name.trim())
                .map((a) => ({
                  name: a.name.trim(),
                  type: a.type,
                  openingBalance: toWire(a.minor ?? 0n),
                  openingDate: new Date().toISOString().slice(0, 10),
                })),
          categories: skip.includes(4) ? [] : categories,
          budgetStyle,
          monthlyTakeHome: null,
          skippedSteps: skip,
        };
        const updated = await api.finishSetup(user.workspaceId, body);
        await new WorkspaceRepository(sync.store, sync.engine, updated.workspaceId).seedFromSetup(body);
        setUser(updated);
        successHaptic();
        setStep('done');
      } catch {
        setError(t('errors.generic'));
      } finally {
        setBusy(false);
      }
    },
    [user, api, sync.store, sync.engine, workspaceName, weekStart, accounts, selectedCats, custom, plan, setUser],
  );

  const saveDraftAccount = (): boolean => {
    if (!draft.name.trim()) {
      setDraftError(t('errors.nameRequired'));
      return false;
    }
    if (draft.amountText.trim()) {
      const parsed = parseAmount(draft.amountText);
      if (!parsed.ok) {
        setDraftError(t('money.unreadable'));
        return false;
      }
      setAccounts((all) => [...all, { ...draft, minor: parsed.minor }]);
    } else {
      setAccounts((all) => [...all, { ...draft, minor: 0n }]);
    }
    setDraft({ name: '', type: 'bank', amountText: '', minor: null });
    setDraftError(null);
    return true;
  };

  const onAccountsContinue = useCallback(() => {
    if (accountPath === 'connect') {
      markSkip(3, true);
      setAccounts([]);
      setStep(4);
      return;
    }
    if (accountPath === 'manual') {
      markSkip(3, false);
      setStep('manual');
    }
  }, [accountPath]);

  useEffect(() => {
    if (Platform.OS !== 'web' || step === 'done' || step === 'start') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !busy) {
        e.preventDefault();
        if (step === 1 && workspaceName.trim()) setStep(2);
        else if (step === 2) setStep(3);
        else if (step === 3 && accountPath) onAccountsContinue();
        else if (step === 5) void finish(skipped);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, busy, workspaceName, accountPath, onAccountsContinue, finish, skipped]);

  const institution = matchInstitution(draft.name, institutions);
  let body: ReactNode = null;

  if (step === 'done') {
    body = (
      <View testID="welcome-done" style={{ gap: sp.xl, flexGrow: 1, justifyContent: 'space-between' }}>
        <View style={{ gap: sp.lg, alignItems: 'flex-start' }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RedesignIcon name="check" size={size['icon-xl']} color={theme.primary} />
          </View>
          <View style={{ gap: sp.sm }}>
            <RedesignText variant="title" accessibilityRole="header">
              {t('welcome.redesign.doneTitle')}
            </RedesignText>
            <RedesignText tone="textSecondary">{t('welcome.redesign.doneBody')}</RedesignText>
          </View>
        </View>
        <RedesignButton
          testID="go-dashboard"
          kind="primary"
          label={t('welcome.redesign.goHome')}
          fullWidth
          onPress={() => router.replace('/')}
        />
      </View>
    );
  } else if (step === 'start') {
    body = (
      <View testID="redesign-welcome-start" style={{ gap: sp.xl, flexGrow: 1 }}>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('welcome.redesign.startTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('welcome.redesign.startBody')}</RedesignText>
        </View>
        <View style={{ gap: sp.lg }}>
          {START_ITEMS.map((item) => (
            <View key={item.titleKey} style={{ gap: 2 }}>
              <RedesignText variant="label">{t(item.titleKey)}</RedesignText>
              <RedesignText variant="helper" tone="textSecondary">
                {t(item.bodyKey)}
              </RedesignText>
            </View>
          ))}
        </View>
        <Footer primary={t('welcome.redesign.getStarted')} onPrimary={() => setStep(1)} />
      </View>
    );
  } else if (step === 1) {
    body = (
      <View testID="redesign-welcome-space" style={{ gap: sp.xl, flexGrow: 1 }}>
        <StepProgress step={1} />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('welcome.redesign.spaceTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('welcome.redesign.spaceBody')}</RedesignText>
        </View>
        <RedesignField
          testID="workspace-name"
          label={t('welcome.redesign.spaceName')}
          value={workspaceName}
          onChangeText={setWorkspaceName}
          placeholder={t('welcome.step1.default')}
          autoFocus
        />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label">{t('welcome.redesign.whoFor')}</RedesignText>
          <RedesignChoiceCard
            testID="audience-solo"
            title={t('welcome.redesign.solo')}
            body={t('welcome.redesign.soloBody')}
            selected={audience === 'solo'}
            onPress={() => setAudience('solo')}
          />
          <RedesignChoiceCard
            testID="audience-household"
            title={t('welcome.redesign.household')}
            body={t('welcome.redesign.householdBody')}
            selected={audience === 'household'}
            onPress={() => setAudience('household')}
          />
        </View>
        {error ? <RedesignInlineError message={error} /> : null}
        <Footer
          primary={t('common.continue')}
          onPrimary={() => {
            markSkip(1, false);
            setStep(2);
          }}
          primaryDisabled={!workspaceName.trim() || busy}
          showBack
          onBack={goBack}
        />
      </View>
    );
  } else if (step === 2) {
    body = (
      <View testID="redesign-welcome-money" style={{ gap: sp.xl, flexGrow: 1 }}>
        <StepProgress step={2} />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('welcome.redesign.moneyTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('welcome.redesign.moneyBody')}</RedesignText>
        </View>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label">{t('welcome.step2.currency')}</RedesignText>
          <RedesignChoiceCard
            testID="currency-NGN"
            title={t('welcome.redesign.currencyNgn')}
            selected
            onPress={() => undefined}
          />
        </View>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label">{t('welcome.redesign.numberFormat')}</RedesignText>
          <RedesignChoiceCard testID="number-format" title="1,234.56" selected onPress={() => undefined} />
        </View>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label">{t('welcome.redesign.weekStarts')}</RedesignText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
            {WEEK_STARTS.map((d) => (
              <RedesignChip
                key={d}
                testID={`week-${d}`}
                label={t(`welcome.day.${d}` as TextKey)}
                selected={weekStart === d}
                onPress={() => setWeekStart(d)}
              />
            ))}
          </View>
        </View>
        <Footer
          primary={t('common.continue')}
          onPrimary={() => {
            markSkip(2, false);
            setStep(3);
          }}
          primaryDisabled={busy}
          showBack
          onBack={goBack}
        />
      </View>
    );
  } else if (step === 3) {
    body = (
      <View testID="redesign-welcome-accounts" style={{ gap: sp.xl, flexGrow: 1 }}>
        <StepProgress step={3} />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('welcome.redesign.accountsTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('welcome.redesign.accountsBody')}</RedesignText>
        </View>
        <RedesignChoiceCard
          testID="account-connect"
          title={t('welcome.redesign.connectBank')}
          body={t('welcome.redesign.connectBankBody')}
          selected={accountPath === 'connect'}
          onPress={() => setAccountPath('connect')}
        />
        <RedesignChoiceCard
          testID="account-manual"
          title={t('welcome.redesign.addManually')}
          body={t('welcome.redesign.addManuallyBody')}
          selected={accountPath === 'manual'}
          onPress={() => setAccountPath('manual')}
        />
        <Footer
          primary={t('common.continue')}
          onPrimary={onAccountsContinue}
          primaryDisabled={!accountPath || busy}
          onSkip={() => {
            markSkip(3, true);
            setAccounts([]);
            setStep(4);
          }}
          showBack
          onBack={goBack}
        />
      </View>
    );
  } else if (step === 'manual') {
    body = (
      <View testID="redesign-welcome-manual" style={{ gap: sp.xl, flexGrow: 1 }}>
        <StepProgress step={3} />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('welcome.redesign.manualTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('welcome.redesign.manualBody')}</RedesignText>
        </View>
        {institution ? <WelcomeInstitutionBadge institution={institution} testID="institution-0" /> : null}
        <RedesignField
          testID="account-name-0"
          label={t('welcome.step3.name')}
          value={draft.name}
          onChangeText={(name) => {
            setDraft((d) => ({ ...d, name }));
            setDraftError(null);
          }}
          placeholder={t('welcome.redesign.accountPlaceholder')}
          autoFocus
        />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label">{t('welcome.redesign.accountType')}</RedesignText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
            {ACCOUNT_TYPES.map((type) => (
              <RedesignChip
                key={type}
                label={t(`welcome.type.${type}` as TextKey)}
                selected={draft.type === type}
                onPress={() => setDraft((d) => ({ ...d, type }))}
              />
            ))}
          </View>
        </View>
        <RedesignField
          testID="account-opening-0"
          label={t('welcome.redesign.balanceToday')}
          value={draft.amountText}
          onChangeText={(amountText) => {
            const parsed = amountText.trim() ? parseAmount(amountText) : null;
            setDraft((d) => ({
              ...d,
              amountText,
              minor: parsed && parsed.ok ? parsed.minor : null,
            }));
            setDraftError(null);
          }}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        {draftError ? <RedesignInlineError message={draftError} /> : null}
        {accounts.length ? (
          <RedesignText variant="caption" tone="textSecondary">
            {t('welcome.redesign.accountsSaved', { n: accounts.length })}
          </RedesignText>
        ) : null}
        <RedesignButton
          testID="add-another-account"
          kind="secondary"
          label={t('welcome.redesign.addAnother')}
          fullWidth
          onPress={() => {
            if (saveDraftAccount()) {
              /* draft cleared for next */
            }
          }}
        />
        <Footer
          primary={t('welcome.redesign.saveAccount')}
          onPrimary={() => {
            const hasDraft = draft.name.trim().length > 0;
            if (hasDraft && !saveDraftAccount()) return;
            if (!hasDraft && accounts.length === 0) {
              setDraftError(t('errors.nameRequired'));
              return;
            }
            markSkip(3, false);
            setStep(4);
          }}
          primaryDisabled={busy}
          showBack
          onBack={goBack}
        />
      </View>
    );
  } else if (step === 4) {
    const selectedCount = selectedCats.size + custom.length;
    body = (
      <View testID="redesign-welcome-categories" style={{ gap: sp.xl, flexGrow: 1 }}>
        <StepProgress step={4} />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('welcome.redesign.categoriesTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('welcome.redesign.categoriesBody')}</RedesignText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
          {REDESIGN_CATEGORIES.map((c) => (
            <RedesignChip
              key={c.key}
              testID={`category-${c.key}`}
              label={t(c.labelKey)}
              selected={selectedCats.has(c.key)}
              onPress={() =>
                setSelectedCats((s) => {
                  const n = new Set(s);
                  if (n.has(c.key)) n.delete(c.key);
                  else n.add(c.key);
                  return n;
                })
              }
            />
          ))}
          {custom.map((name) => (
            <RedesignChip key={name} label={name} selected onPress={() => setCustom((c) => c.filter((x) => x !== name))} />
          ))}
        </View>
        <RedesignText variant="caption" tone="textSecondary">
          {t('welcome.redesign.selectedCount', { n: selectedCount })}
        </RedesignText>
        {showCustom ? (
          <View style={{ gap: sp.md }}>
            <RedesignField
              testID="new-category"
              label={t('welcome.step4.newLabel')}
              value={newCategory}
              onChangeText={setNewCategory}
            />
            <RedesignButton
              kind="secondary"
              label={t('welcome.step4.addConfirm')}
              disabled={!newCategory.trim()}
              onPress={() => {
                setCustom((c) => [...new Set([...c, newCategory.trim()])]);
                setNewCategory('');
                setShowCustom(false);
              }}
            />
          </View>
        ) : (
          <RedesignButton
            testID="add-own-category"
            kind="link"
            label={t('welcome.redesign.addOwnCategory')}
            onPress={() => setShowCustom(true)}
            accessibilityRole="link"
          />
        )}
        <Footer
          primary={t('common.continue')}
          onPrimary={() => {
            markSkip(4, false);
            setStep(5);
          }}
          primaryDisabled={busy}
          onSkip={() => {
            markSkip(4, true);
            setStep(5);
          }}
          showBack
          onBack={goBack}
        />
      </View>
    );
  } else if (step === 5) {
    body = (
      <View testID="redesign-welcome-budget" style={{ gap: sp.xl, flexGrow: 1 }}>
        <StepProgress step={5} />
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('welcome.redesign.budgetTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('welcome.redesign.budgetBody')}</RedesignText>
        </View>
        <RedesignChoiceCard
          testID="style-envelope"
          title={t('welcome.redesign.planEvery')}
          body={t('welcome.redesign.planEveryBody')}
          selected={plan === 'envelope'}
          onPress={() => setPlan('envelope')}
        />
        <RedesignChoiceCard
          testID="style-tracking"
          title={t('welcome.redesign.setLimits')}
          body={t('welcome.redesign.setLimitsBody')}
          selected={plan === 'limits'}
          onPress={() => setPlan('limits')}
        />
        <RedesignChoiceCard
          testID="style-track"
          title={t('welcome.redesign.justTrack')}
          body={t('welcome.redesign.justTrackBody')}
          selected={plan === 'track'}
          onPress={() => setPlan('track')}
        />
        {error ? <RedesignInlineError message={error} /> : null}
        <Footer
          primary={t('welcome.redesign.finish')}
          onPrimary={() => {
            markSkip(5, false);
            void finish(skipped.filter((s) => s !== 5));
          }}
          primaryDisabled={busy}
          showBack
          onBack={goBack}
        />
      </View>
    );
  }

  return <RedesignSetupFrame>{body}</RedesignSetupFrame>;
}
