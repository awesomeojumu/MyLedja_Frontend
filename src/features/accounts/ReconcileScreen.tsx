import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
  Checkbox,
  Confirm,
  DatePicker,
  Footer,
  Placeholder,
  Sheet,
  StatusPill,
  Text,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { ACCOUNT_KIND_INFO } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAddTransaction } from '@/features/transactions/AddTransaction';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { register, type RegisterRow } from './AccountScreen';

const sp = tokens.spacing;

/** Uncleared rows up to the statement date. Already-reconciled (locked) rows stay out (P10). */
export function reconcileRows(snapshot: Snapshot, accountId: string, statementDate: string): RegisterRow[] {
  return register(snapshot, accountId).filter((r) => r.event.date <= statementDate && !r.event.reconciledBy);
}

/** Cleared total as the person sees it (assets: balance; liabilities: amount owed). */
export function clearedShown(rows: RegisterRow[], eventIds: Set<string>, liability: boolean): bigint {
  let total = 0n;
  for (const r of rows) if (eventIds.has(r.event.id)) total += r.line;
  return liability ? -total : total;
}

export function ReconcileScreen() {
  const { snapshot, repo } = useWorkspace();
  const params = useGlobalSearchParams<{ id?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const toast = useToast();
  const add = useAddTransaction();
  const account = snapshot?.accounts.find((a) => a.id === params.id);

  const [statementDate, setStatementDate] = useState(today());
  const [statementText, setStatementText] = useState('');
  const [statementMinor, setStatementMinor] = useState<bigint | null>(null);
  /** Manual ticks/unticks keyed by event id; cleared when the account or statement date changes. */
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

  const liability = account ? ACCOUNT_KIND_INFO[account.type].ledger === 'liability' : false;
  const rows = useMemo(
    () => (snapshot && account ? reconcileRows(snapshot, account.id, statementDate) : []),
    [snapshot, account, statementDate],
  );
  const ticked = useMemo(() => {
    const next = new Set(rows.filter((r) => r.event.cleared).map((r) => r.event.id));
    for (const [id, on] of Object.entries(overrides)) {
      if (on) next.add(id);
      else next.delete(id);
    }
    return next;
  }, [rows, overrides]);

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

  const leave = () => router.push(`/accounts/${account.id}`);

  const finish = async (withAdjustment: boolean) => {
    if (statementMinor === null) return;
    setBusy(true);
    const r = await repo.finishReconcile({
      accountId: account.id,
      statementDate,
      statementBalance: statementMinor,
      eventIds: [...ticked],
      withAdjustment,
    });
    setBusy(false);
    setAdjustOpen(false);
    if (!r.ok) return;
    toast.show(t('reconcile.done'));
    leave();
  };

  const onFinish = () => {
    if (statementMinor === null) return;
    if (difference === 0n) void finish(false);
    else setAdjustOpen(true);
  };

  const absDiff = difference < 0n ? -difference : difference;
  const title = t('reconcile.title', { account: account.name });

  return (
    <AppFrame title={title}>
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
                <StatusPill label={t('reconcile.balanced')} kind="done" />
              </View>
            ) : statementMinor === null ? (
              <Text testID="reconcile-difference-pending" tone="textSecondary">
                {t('reconcile.amountUnknown')}
              </Text>
            ) : (
              <Amount testID="reconcile-difference" minor={difference} signed />
            )}
          </View>
        </View>

        {rows.length === 0 ? (
          <Text tone="textSecondary">{t('reconcile.empty')}</Text>
        ) : (
          <View style={{ gap: sp['spacing-sm'] }} testID="reconcile-list">
            {rows.map((r) => {
              const shown = liability ? -r.line : r.line;
              const checked = ticked.has(r.event.id);
              return (
                <View
                  key={r.event.id}
                  testID={`reconcile-row-${r.event.id}`}
                  style={{
                    gap: sp['spacing-xs'],
                    paddingVertical: sp['spacing-sm'],
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
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
                    onChange={(v) => setOverrides((prev) => ({ ...prev, [r.event.id]: v }))}
                    caption={`${r.event.date}${r.category ? ` · ${r.category}` : ''}`}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <Amount minor={shown} signed />
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
      </ScrollView>

      <Confirm
        visible={leaveOpen}
        title={t('reconcile.leaveTitle')}
        body={t('reconcile.leaveBody')}
        confirmLabel={t('reconcile.leaveConfirm')}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          leave();
        }}
      />
      <Sheet
        visible={adjustOpen}
        testID="reconcile-adjust-sheet"
        title={t('reconcile.adjustTitle', { amount: formatNaira(absDiff) })}
        onClose={() => setAdjustOpen(false)}
        footer={
          <Footer>
            <Button testID="reconcile-keep-going" kind="secondary" label={t('reconcile.keepGoing')} onPress={() => setAdjustOpen(false)} />
            <Button testID="reconcile-adjust" label={t('reconcile.adjustConfirm')} onPress={() => void finish(true)} />
          </Footer>
        }
      >
        <Text tone="textSecondary">{t('reconcile.adjustBody', { amount: formatNaira(absDiff) })}</Text>
      </Sheet>
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
