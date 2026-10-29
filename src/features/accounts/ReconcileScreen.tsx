import { useGlobalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, Vibration, View } from 'react-native';

import { reconcileApi } from '@/api/reconcile';
import {
  Amount,
  AmountInput,
  Button,
  Checkbox,
  Confirm,
  DatePicker,
  Footer,
  Placeholder,
  StatusPill,
  Text,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import { ACCOUNT_KIND_INFO } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useSync } from '@/data/sync/SyncProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAddTransaction } from '@/features/transactions/AddTransaction';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { formatNaira } from '@/money';

import { register, type RegisterRow } from './AccountScreen';

const sp = tokens.spacing;

/** Uncleared + session-ticked rows up to the statement date (DESIGN / BE candidates). */
export function reconcileRows(
  snapshot: Snapshot,
  accountId: string,
  statementDate: string,
  ticked: Set<string>,
): RegisterRow[] {
  return register(snapshot, accountId).filter(
    (r) => r.event.date <= statementDate && !r.event.reconciledBy && (!r.event.cleared || ticked.has(r.event.id)),
  );
}

/** Cleared total as the person sees it (assets: balance; liabilities: amount owed). */
export function clearedShown(rows: RegisterRow[], eventIds: Set<string>, liability: boolean): bigint {
  let total = 0n;
  for (const r of rows) if (eventIds.has(r.event.id)) total += r.line;
  return liability ? -total : total;
}

function successHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(40);
  } catch {
    /* unsupported */
  }
}

export function ReconcileScreen() {
  const { snapshot, repo } = useWorkspace();
  const { engine } = useSync();
  const { client, user, source } = useAuth();
  const online = useOnline();
  const api = useMemo(() => reconcileApi(client), [client]);
  const canUseApi = Boolean(user && online && source !== 'mock');
  const params = useGlobalSearchParams<{ id?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const toast = useToast();
  const add = useAddTransaction();
  const phone = useSizeClass() === 'phone';
  const account = snapshot?.accounts.find((a) => a.id === params.id);

  const [statementDate, setStatementDate] = useState(today());
  const [statementText, setStatementText] = useState('');
  const [statementMinor, setStatementMinor] = useState<bigint | null>(null);
  /** Manual ticks keyed by event id; cleared when the account or statement date changes. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const seedKey = `${account?.id ?? ''}:${statementDate}`;
  const [activeSeed, setActiveSeed] = useState(seedKey);
  if (activeSeed !== seedKey) {
    setActiveSeed(seedKey);
    setOverrides({});
  }
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reconId, setReconId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const lastClicked = useRef<string | null>(null);
  const shiftHeld = useRef(false);
  const allowLeave = useRef(false);

  const liability = account ? ACCOUNT_KIND_INFO[account.type].ledger === 'liability' : false;
  const ticked = useMemo(() => {
    const next = new Set<string>();
    for (const [id, on] of Object.entries(overrides)) {
      if (on) next.add(id);
    }
    return next;
  }, [overrides]);
  const rows = useMemo(
    () => (snapshot && account ? reconcileRows(snapshot, account.id, statementDate, ticked) : []),
    [snapshot, account, statementDate, ticked],
  );

  // P10-06: no accidental leave (iOS edge swipe / stack back).
  useEffect(() => {
    // expo-router's typed navigator omits beforeRemove; runtime still supports it.
    const nav = navigation as unknown as {
      setOptions?: (o: { gestureEnabled: boolean }) => void;
      addListener?: (event: string, cb: (e: { preventDefault: () => void }) => void) => () => void;
    };
    nav.setOptions?.({ gestureEnabled: false });
    const sub = nav.addListener?.('beforeRemove', (e) => {
      if (allowLeave.current) return;
      e.preventDefault();
      setLeaveOpen(true);
    });
    return () => {
      nav.setOptions?.({ gestureEnabled: true });
      sub?.();
    };
  }, [navigation]);

  // P10-06: Android hardware Back → leave Confirm.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setLeaveOpen(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  // Web/tablet: Space ticks the focused row (DESIGN 928–929).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !focusedId) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      toggleTick(focusedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // toggleTick closes over latest overrides via functional update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId]);

  // Success haptic when difference first reaches ₦0 (P10-02).
  const wasBalanced = useRef(false);
  useEffect(() => {
    const nowBalanced =
      statementMinor !== null && statementMinor - clearedShown(rows, ticked, liability) === 0n;
    if (nowBalanced && !wasBalanced.current) successHaptic();
    wasBalanced.current = nowBalanced;
  }, [statementMinor, rows, ticked, liability]);

  if (!snapshot) {
    return (
      <AppFrame title={t('account.reconcile')}>
        <Placeholder />
      </AppFrame>
    );
  }
  if (!account) {
    return (
      <AppFrame title={t('account.reconcile')}>
        <View style={{ gap: sp['spacing-md'], padding: sp['spacing-xl'] }}>
          <Text variant="heading-sm">{t('account.missingTitle')}</Text>
          <Text tone="textSecondary">{t('account.missingBody')}</Text>
          <Button label={t('account.back')} onPress={() => router.push('/accounts')} />
        </View>
      </AppFrame>
    );
  }

  const cleared = clearedShown(rows, ticked, liability);
  const difference = statementMinor === null ? 0n : statementMinor - cleared;
  const balanced = statementMinor !== null && difference === 0n;
  const absDiff = difference < 0n ? -difference : difference;
  const title = t('reconcile.title', { account: account.name });

  const leave = () => {
    allowLeave.current = true;
    router.push(`/accounts/${account.id}`);
  };

  async function ensureStarted(accountId: string): Promise<string | null> {
    if (!canUseApi || !user || statementMinor === null) return reconId;
    if (reconId) return reconId;
    const view = await api.start(user.workspaceId, accountId, {
      statementDate,
      statementBalance: statementMinor.toString(),
    });
    setReconId(view.reconciliation.id);
    const next: Record<string, boolean> = {};
    for (const id of view.reconciliation.tickedIds) next[id] = true;
    setOverrides((prev) => ({ ...next, ...prev }));
    return view.reconciliation.id;
  }

  function toggleTick(id: string, shiftRange = false) {
    const nextOn = !overrides[id];
    setOverrides((prev) => {
      const on = !prev[id];
      const next = { ...prev };
      if (shiftRange && lastClicked.current && Platform.OS === 'web') {
        const ids = rows.map((r) => r.event.id);
        const a = ids.indexOf(lastClicked.current);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next[ids[i]!] = on;
        } else {
          next[id] = on;
        }
      } else {
        next[id] = on;
      }
      return next;
    });
    lastClicked.current = id;
    if (canUseApi && user && account) {
      void (async () => {
        try {
          const idStarted = await ensureStarted(account.id);
          if (!idStarted) return;
          await api.tick(user.workspaceId, idStarted, { transactionIds: [id], cleared: nextOn });
        } catch {
          /* local ticks still drive the UI; sync will reconcile */
        }
      })();
    }
  }

  const finish = async (withAdjustment: boolean) => {
    if (statementMinor === null || !account) return;
    setBusy(true);
    try {
      if (canUseApi && user) {
        const idStarted = await ensureStarted(account.id);
        if (!idStarted) throw new Error('no_reconcile');
        // Align server ticks with the local set before finish.
        const viewBefore = await api.get(user.workspaceId, idStarted);
        const serverTicked = new Set(viewBefore.reconciliation.tickedIds);
        const toClear = [...ticked].filter((tid) => !serverTicked.has(tid));
        const toUncleared = [...serverTicked].filter((tid) => !ticked.has(tid));
        if (toClear.length) await api.tick(user.workspaceId, idStarted, { transactionIds: toClear, cleared: true });
        if (toUncleared.length) await api.tick(user.workspaceId, idStarted, { transactionIds: toUncleared, cleared: false });
        const preDiff = difference;
        const view = await api.finish(user.workspaceId, idStarted, { adjust: withAdjustment });
        await repo.applyServerReconcile({
          id: view.reconciliation.id,
          accountId: view.reconciliation.accountId,
          statementDate: view.reconciliation.statementDate,
          statementBalance: view.reconciliation.statementBalance,
          cleared: view.reconciliation.cleared,
          tickedIds: view.reconciliation.tickedIds,
          adjustmentId: view.reconciliation.adjustmentId,
          finishedAt: view.reconciliation.finishedAt,
          finishedBy: view.reconciliation.finishedBy,
          adjustmentMinor: withAdjustment ? preDiff.toString() : '0',
        });
        void engine.sync({ force: true }).catch(() => null);
      } else {
        const r = await repo.finishReconcile({
          accountId: account.id,
          statementDate,
          statementBalance: statementMinor,
          eventIds: [...ticked],
          withAdjustment,
          finishedBy: user?.id,
        });
        if (!r.ok) return;
      }
      setAdjustOpen(false);
      toast.show(t('reconcile.done'));
      leave();
    } catch {
      toast.show(t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const onFinish = () => {
    if (statementMinor === null) return;
    if (difference === 0n) void finish(false);
    else setAdjustOpen(true);
  };

  const onConfirmLeave = () => {
    setLeaveOpen(false);
    if (canUseApi && user && reconId) {
      void api.cancel(user.workspaceId, reconId).catch(() => null);
    }
    leave();
  };

  const totals = (
    <View
      testID="reconcile-totals"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: sp['spacing-md'],
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: tokens.radius['rounded-md'],
        padding: sp['spacing-md'],
        backgroundColor: theme.page,
      }}
    >
      <Total label={t('reconcile.cleared')} minor={cleared} testID="reconcile-cleared" />
      <Total label={t('reconcile.statementSays')} minor={statementMinor} testID="reconcile-says" />
      <View style={{ flexGrow: 1, minWidth: 120, gap: sp['spacing-xxs'] }}>
        <Text variant="caption" tone="textSecondary">
          {t('reconcile.difference')}
        </Text>
        {balanced ? (
          <View testID="reconcile-balanced">
            <StatusPill label={`✓ ${t('reconcile.balanced')}`} kind="done" />
          </View>
        ) : statementMinor === null ? (
          <Text testID="reconcile-difference-pending" tone="textSecondary">
            {t('reconcile.amountUnknown')}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
            <View
              testID="reconcile-difference-ruby"
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.error }}
            />
            <Amount testID="reconcile-difference" minor={difference} signed />
          </View>
        )}
      </View>
    </View>
  );

  const rowList =
    rows.length === 0 ? (
      <Text tone="textSecondary">{t('reconcile.empty')}</Text>
    ) : (
      <View style={{ gap: sp['spacing-sm'] }} testID="reconcile-list">
        {rows.map((r) => {
          const shown = liability ? -r.line : r.line;
          const checked = ticked.has(r.event.id);
          return (
            <Pressable
              key={r.event.id}
              testID={`reconcile-row-${r.event.id}`}
              accessibilityRole="button"
              onFocus={() => setFocusedId(r.event.id)}
              onPressIn={(e) => {
                setFocusedId(r.event.id);
                shiftHeld.current =
                  Platform.OS === 'web' &&
                  !!(e as unknown as { nativeEvent?: { shiftKey?: boolean }; shiftKey?: boolean }).nativeEvent?.shiftKey;
              }}
              style={{
                gap: sp['spacing-xs'],
                padding: sp['spacing-md'],
                borderWidth: 1,
                borderColor: focusedId === r.event.id ? theme.link : theme.border,
                borderRadius: tokens.radius['rounded-md'],
                backgroundColor: phone ? theme.card : undefined,
              }}
            >
              <Checkbox
                testID={`reconcile-tick-${r.event.id}`}
                label={t('reconcile.rowLabel', {
                  cleared: checked ? t('reconcile.tick') : t('reconcile.untick'),
                  title: r.title,
                  amount: formatNaira(shown),
                })}
                checked={checked}
                onChange={() => {
                  const shift = shiftHeld.current;
                  shiftHeld.current = false;
                  toggleTick(r.event.id, shift);
                }}
                caption={`${r.event.date}${r.category ? ` · ${r.category}` : ''}`}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Amount minor={shown} signed />
              </View>
            </Pressable>
          );
        })}
      </View>
    );

  return (
    <AppFrame title={title}>
      <View style={{ flex: 1, gap: sp['spacing-lg'] }}>
        {phone ? <View testID="reconcile-sticky-totals">{totals}</View> : null}
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'], paddingBottom: sp['spacing-huge'] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
            <View style={{ flexGrow: 1, minWidth: 160 }}>
              <DatePicker testID="reconcile-date" label={t('reconcile.statementDate')} value={statementDate} onChange={setStatementDate} />
            </View>
            <View style={{ flexGrow: 1, minWidth: 160 }}>
              <AmountInput
                testID="reconcile-statement"
                label={t('reconcile.statementBalance')}
                value={statementText}
                onChange={(text, minor) => {
                  setStatementText(text);
                  setStatementMinor(minor);
                }}
              />
            </View>
          </View>
          {phone ? null : totals}
          {rowList}
        </ScrollView>

        <Footer>
          <Button testID="reconcile-cancel" kind="secondary" label={t('common.cancel')} onPress={() => setLeaveOpen(true)} />
          <Button
            testID="reconcile-add-missing"
            kind="secondary"
            label={t('reconcile.addMissing')}
            onPress={() => add.open('expense', { accountId: account.id, date: statementDate })}
          />
          <Button testID="reconcile-finish" label={t('reconcile.finish')} disabled={statementMinor === null || busy} onPress={onFinish} />
        </Footer>
      </View>

      <Confirm
        visible={leaveOpen}
        title={t('reconcile.leaveTitle')}
        body={t('reconcile.leaveBody')}
        confirmLabel={t('reconcile.leaveConfirm')}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={onConfirmLeave}
      />
      <Confirm
        visible={adjustOpen}
        testID="reconcile-adjust"
        title={t('reconcile.adjustTitle', { amount: formatNaira(absDiff) })}
        body={t('reconcile.adjustBody', { amount: formatNaira(absDiff) })}
        confirmLabel={t('reconcile.adjustConfirm')}
        onCancel={() => setAdjustOpen(false)}
        onConfirm={() => void finish(true)}
      />
    </AppFrame>
  );
}

function Total({ label, minor, testID }: { label: string; minor: bigint | null; testID: string }) {
  return (
    <View style={{ flexGrow: 1, minWidth: 120, gap: sp['spacing-xxs'] }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      {minor === null ? (
        <Text testID={`${testID}-pending`} tone="textSecondary">
          {t('reconcile.amountUnknown')}
        </Text>
      ) : (
        <Amount testID={testID} minor={minor} />
      )}
    </View>
  );
}
