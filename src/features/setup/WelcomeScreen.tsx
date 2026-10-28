import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountInput, Button, DatePicker, Card, InlineError, PillTag, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import { t, type TextKey } from '@/i18n';
import { toWire } from '@/money';
import { GradientMeshBackdrop } from '@/features/auth/AuthFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import type { SetupBody } from '@/api/auth';
import { useSync } from '@/data/sync/SyncProvider';
import { WorkspaceRepository } from '@/data/workspace/repository';
import { WelcomeCurrencyPicker } from './WelcomeCurrencyPicker';
import { WelcomeInstitutionBadge } from './WelcomeInstitutionBadge';
import { matchInstitution } from './institutions';
import { ACCOUNT_TYPES, STARTER_GROUPS, WEEK_STARTS, type AccountType } from './starter';

type AccountRow = { name: string; type: AccountType; amountText: string; minor: bigint | null; date: string };

const sp = tokens.spacing;
const c = tokens.color;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function StepTitle({ children }: { children: string }) {
  const size = useSizeClass();
  return (
    <Text variant={size === 'phone' ? 'display-md' : 'display-xl'} accessibilityRole="header">
      {children}
    </Text>
  );
}

function WelcomeFooter({
  step,
  busy,
  canContinue,
  onBack,
  onSkip,
  onContinue,
}: {
  step: number;
  busy: boolean;
  canContinue: boolean;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: sp['spacing-md'],
        paddingHorizontal: sp['spacing-lg'],
        paddingVertical: sp['spacing-md'],
        borderTopWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.canvas,
      }}
    >
      {step > 1 ? <Button kind="link" testID="back" label={t('common.back')} onPress={onBack} /> : <View />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-lg'] }}>
        <Button kind="link" testID="skip" label={t('common.skip')} onPress={onSkip} disabled={busy} />
        <Button testID="continue" label={t('common.continue')} onPress={onContinue} disabled={!canContinue || busy} />
      </View>
    </View>
  );
}

export function WelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const { api, user, setUser } = useAuth();
  const sync = useSync();
  const [step, setStep] = useState(1);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [workspaceName, setWorkspaceName] = useState(t('welcome.step1.default'));
  const [weekStart, setWeekStart] = useState<(typeof WEEK_STARTS)[number]>('monday');
  const [accounts, setAccounts] = useState<AccountRow[]>([{ name: '', type: 'bank', amountText: '', minor: null, date: todayIso() }]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<string[]>([]);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [style, setStyle] = useState<'tracking' | 'envelope'>('tracking');
  const [takeHome, setTakeHome] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountGrid = size === 'tablet' && width > height;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1 && step <= 5) {
        setStep((s) => s - 1);
        return true;
      }
      return step <= 5;
    });
    return () => sub.remove();
  }, [step]);

  const amountsReadable =
    accounts.every((a) => a.amountText.trim() === '' || a.minor !== null) && (takeHome.text.trim() === '' || takeHome.minor !== null);
  const canContinue = (step !== 1 || workspaceName.trim() !== '') && amountsReadable;

  const finish = useCallback(
    async (skip: number[]) => {
      if (!user) return;
      setBusy(true);
      setError(null);
      try {
        const categories = STARTER_GROUPS.flatMap(({ group, categories: keys }) =>
          keys.filter((k) => !off.has(k)).map((k) => ({ key: k, group, name: t(k) })),
        );
        const body: SetupBody = {
          workspaceName: skip.includes(1) ? t('welcome.step1.default') : workspaceName.trim(),
          currency: 'NGN',
          weekStart,
          accounts: skip.includes(3)
            ? []
            : accounts
                .filter((a) => a.name.trim())
                .map((a) => ({ name: a.name.trim(), type: a.type, openingBalance: toWire(a.minor ?? 0n), openingDate: a.date })),
          categories: skip.includes(4) ? [] : [...categories, ...custom.map((name) => ({ key: `custom:${name}`, group: 'custom', name }))],
          budgetStyle: style,
          monthlyTakeHome: takeHome.minor === null ? null : toWire(takeHome.minor),
          skippedSteps: skip,
        };
        const updated = await api.finishSetup(user.workspaceId, body);
        await new WorkspaceRepository(sync.store, sync.engine, updated.workspaceId).seedFromSetup(body);
        setUser(updated);
        setStep(6);
      } catch {
        setError(t('errors.generic'));
      } finally {
        setBusy(false);
      }
    },
    [user, api, sync.store, sync.engine, workspaceName, weekStart, accounts, off, custom, style, takeHome, setUser],
  );

  const next = useCallback(
    (skip = false) => {
      const nextSkipped = skip ? [...new Set([...skipped, step])] : skipped.filter((s) => s !== step);
      setSkipped(nextSkipped);
      if (step === 5) void finish(nextSkipped);
      else setStep(step + 1);
    },
    [skipped, step, finish],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || step === 6) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && canContinue && !busy) {
        e.preventDefault();
        next(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, canContinue, busy, next]);

  const stepBody = (() => {
    if (step === 1) {
      return (
        <View style={{ gap: sp['spacing-lg'] }}>
          <StepTitle>{t('welcome.step1.title')}</StepTitle>
          <TextInput testID="workspace-name" label={t('welcome.step1.label')} value={workspaceName} onChangeText={setWorkspaceName} autoFocus />
        </View>
      );
    }
    if (step === 2) {
      return (
        <View style={{ gap: sp['spacing-lg'] }}>
          <StepTitle>{t('welcome.step2.title')}</StepTitle>
          <WelcomeCurrencyPicker />
          <View style={{ gap: sp['spacing-xs'] }}>
            <Text variant="caption" tone="textSecondary">{t('welcome.step2.weekStart')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }} accessibilityRole="radiogroup">
              {WEEK_STARTS.map((d) => (
                <PillTag key={d} testID={`week-${d}`} label={t(`welcome.day.${d}` as TextKey)} selected={weekStart === d} onPress={() => setWeekStart(d)} />
              ))}
            </View>
          </View>
        </View>
      );
    }
    if (step === 3) {
      return (
        <View style={{ gap: sp['spacing-lg'] }}>
          <StepTitle>{t('welcome.step3.title')}</StepTitle>
          <View style={{ flexDirection: accountGrid ? 'row' : 'column', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
            {accounts.map((a, i) => {
              const update = (patch: Partial<AccountRow>) => setAccounts((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              const institution = matchInstitution(a.name);
              return (
                <Card key={i} style={{ gap: sp['spacing-md'], width: accountGrid ? '48%' : '100%' }}>
                  {institution ? <WelcomeInstitutionBadge institution={institution} testID={`institution-${i}`} /> : null}
                  <TextInput testID={`account-name-${i}`} label={t('welcome.step3.name')} value={a.name} onChangeText={(name) => update({ name })} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                    {ACCOUNT_TYPES.map((type) => (
                      <PillTag key={type} label={t(`welcome.type.${type}` as TextKey)} selected={a.type === type} onPress={() => update({ type })} />
                    ))}
                  </View>
                  <AmountInput
                    testID={`account-opening-${i}`}
                    label={t('welcome.step3.opening')}
                    value={a.amountText}
                    onChange={(amountText, minor) => update({ amountText, minor })}
                  />
                  <DatePicker label={t('welcome.step3.date')} value={a.date} onChange={(date) => update({ date })} weekStartsOn={weekStart === 'sunday' ? 0 : weekStart === 'saturday' ? 6 : 1} />
                  {accounts.length > 1 ? (
                    <Button kind="link" label={t('welcome.step3.remove')} onPress={() => setAccounts((all) => all.filter((_, j) => j !== i))} />
                  ) : null}
                </Card>
              );
            })}
          </View>
          <Text variant="caption" tone="textHelper">{t('welcome.step3.openingNote')}</Text>
          <Button
            kind="secondary"
            label={t('welcome.step3.another')}
            onPress={() => setAccounts((all) => [...all, { name: '', type: 'bank', amountText: '', minor: null, date: todayIso() }])}
          />
          <Button kind="link" label={t('welcome.step3.later')} onPress={() => next(true)} />
        </View>
      );
    }
    if (step === 4) {
      return (
        <View style={{ gap: sp['spacing-lg'] }}>
          <StepTitle>{t('welcome.step4.title')}</StepTitle>
          <Text tone="textSecondary">{t('welcome.step4.hint')}</Text>
          {STARTER_GROUPS.map(({ group, categories }) => (
            <View key={group} style={{ gap: sp['spacing-sm'] }}>
              <Text variant="micro-cap" tone="textSecondary">{t(group)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
                {categories.map((k) => (
                  <PillTag
                    key={k}
                    testID={`category-${k}`}
                    label={t(k)}
                    selected={!off.has(k)}
                    onPress={() =>
                      setOff((s) => {
                        const n = new Set(s);
                        if (n.has(k)) n.delete(k);
                        else n.add(k);
                        return n;
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ))}
          {custom.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
              {custom.map((name) => (
                <PillTag key={name} label={name} selected onPress={() => setCustom((c) => c.filter((x) => x !== name))} />
              ))}
            </View>
          ) : null}
          {showCustomCategory ? (
            <View style={{ gap: sp['spacing-md'] }}>
              <TextInput testID="new-category" label={t('welcome.step4.newLabel')} value={newCategory} onChangeText={setNewCategory} />
              <Button
                kind="secondary"
                label={t('welcome.step4.addConfirm')}
                disabled={!newCategory.trim()}
                onPress={() => {
                  setCustom((c) => [...new Set([...c, newCategory.trim()])]);
                  setNewCategory('');
                  setShowCustomCategory(false);
                }}
              />
            </View>
          ) : (
            <Button kind="link" testID="add-own-category" label={t('welcome.step4.addOwn')} onPress={() => setShowCustomCategory(true)} />
          )}
        </View>
      );
    }
    if (step === 5) {
      return (
        <View style={{ gap: sp['spacing-lg'] }}>
          <StepTitle>{t('welcome.step5.title')}</StepTitle>
          {(['tracking', 'envelope'] as const).map((s) => (
            <Pressable
              key={s}
              testID={`style-${s}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: style === s }}
              onPress={() => setStyle(s)}
              style={{
                borderWidth: style === s ? 2 : 1,
                borderColor: style === s ? theme.primaryFill : theme.border,
                borderRadius: tokens.radius['rounded-lg'],
                padding: sp['spacing-lg'],
                gap: sp['spacing-xs'],
                backgroundColor: theme.card,
              }}
            >
              <Text variant="heading-sm">{t(s === 'tracking' ? 'welcome.step5.limits' : 'welcome.step5.envelope')}</Text>
              <Text tone="textSecondary">{t(s === 'tracking' ? 'welcome.step5.limitsBody' : 'welcome.step5.envelopeBody')}</Text>
              {s === 'tracking' ? <Text variant="caption" style={{ color: theme.tagText }}>{t('welcome.step5.limitsBadge')}</Text> : null}
            </Pressable>
          ))}
          <Text variant="caption" tone="textHelper">{t('welcome.step5.later')}</Text>
          <AmountInput
            testID="take-home"
            label={`${t('welcome.step5.takeHome')} ${t('common.optional')}`}
            value={takeHome.text}
            onChange={(text, minor) => setTakeHome({ text, minor })}
          />
        </View>
      );
    }
    return null;
  })();

  if (step === 6) {
    return (
      <GradientMeshBackdrop>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp['spacing-lg'] }}>
          <View style={{ width: '100%', maxWidth: tokens.width.form, alignItems: 'center', gap: sp['spacing-xl'] }} testID="welcome-done">
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: c['primary-bg-subdued-hover'],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 24, height: 12, borderLeftWidth: 3, borderBottomWidth: 3, borderColor: c.primary, transform: [{ rotate: '-45deg' }], marginTop: -6 }} />
            </View>
            <Text variant="display-lg" accessibilityRole="header">
              {t('welcome.done.title')}
            </Text>
            <Button testID="go-dashboard" kind="gradient" label={t('welcome.done.dashboard')} fullWidth onPress={() => router.replace('/')} />
            <Button kind="secondary" label={t('welcome.done.add')} fullWidth onPress={() => router.replace('/?add=expense')} />
          </View>
        </SafeAreaView>
      </GradientMeshBackdrop>
    );
  }

  return (
    <GradientMeshBackdrop>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: 'center', padding: sp['spacing-lg'], paddingBottom: sp['spacing-xxl'] }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                width: '100%',
                maxWidth: tokens.width.form,
                backgroundColor: c.canvas,
                borderRadius: tokens.radius['rounded-lg'],
                padding: sp['spacing-xl'],
                gap: sp['spacing-xl'],
                boxShadow: size === 'phone' ? undefined : tokens.elevation['elevation-2'],
              }}
            >
              <View style={{ gap: sp['spacing-sm'] }}>
                <Text variant="caption" tone="textSecondary" testID="step-of">
                  {t('welcome.stepOf', { n: step })}
                </Text>
                <View style={{ flexDirection: 'row', gap: sp['spacing-xs'] }} importantForAccessibility="no-hide-descendants">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? theme.primaryFill : theme.border }} />
                  ))}
                </View>
              </View>
              {stepBody}
              {error ? <InlineError message={error} /> : null}
            </View>
          </ScrollView>
          <WelcomeFooter
            step={step}
            busy={busy}
            canContinue={canContinue}
            onBack={() => setStep(step - 1)}
            onSkip={() => next(true)}
            onContinue={() => next(false)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientMeshBackdrop>
  );
}
