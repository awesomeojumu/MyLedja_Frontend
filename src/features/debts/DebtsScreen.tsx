import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Amount,
  Button,
  Card,
  Confirm,
  EmptyState,
  InlineError,
  Placeholder,
  StatusPill,
  Text,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { PersonDebt } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { DebtScreen } from './DebtScreen';
import { DebtsPaymentSheet } from './DebtsPaymentSheet';
import { DebtScheduleSheet } from './DebtScheduleSheet';
import { MoneyBackReviewSheet } from './MoneyBackReviewSheet';
import { OpenDebtSheet } from './OpenDebtSheet';
import { listMoneyBackReview } from './moneyBack';
import {
  DEBT_URL,
  debtsListTabToFilter,
  directionToDebtDirection,
  filterToDebtsListTab,
  parseDebtDirection,
  parseDebtsListTab,
} from './popupUrl';
import { debtIsOverdue, debtOriginalAmount, debtProgress, nextInstallment } from './schedule';
import { debtClosedDate, debtInitials, debtRows, debtTotals, findRecentPayment, type DebtFilter } from './helpers';

const sp = tokens.spacing;
const FILTERS: DebtFilter[] = ['all', 'owedToMe', 'iOwe', 'settled'];

export function DebtsScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const theme = useTheme();
  const toast = useToast();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const masterDetail = (size === 'tablet' || size === 'desktop' || size === 'wide') && width > height;
  const params = useLocalSearchParams<{
    tab?: string;
    debt?: string;
    payment?: string;
    debtSchedule?: string;
    direction?: string;
    view?: string;
  }>();
  const onDate = today();
  const filter = debtsListTabToFilter(parseDebtsListTab(typeof params.tab === 'string' ? params.tab : undefined));
  const debtParam = typeof params.debt === 'string' ? params.debt : undefined;
  const paymentParam = typeof params.payment === 'string' ? params.payment : undefined;
  const scheduleParam = typeof params.debtSchedule === 'string' ? params.debtSchedule : undefined;
  const viewId = typeof params.view === 'string' ? params.view : undefined;
  const lendOpen = debtParam === 'new';
  const directionParam = parseDebtDirection(typeof params.direction === 'string' ? params.direction : undefined);
  const openDirection: PersonDebt['direction'] =
    directionToDebtDirection(directionParam) ??
    (parseDebtsListTab(typeof params.tab === 'string' ? params.tab : undefined) === 'owe' ? 'iOwe' : 'owedToMe');
  const [pendingScheduleId, setPendingScheduleId] = useState<string | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ accountId: string; principal: bigint; interest: bigint; date: string; overpayment?: 'gift' | 'credit' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moneyBackReview, setMoneyBackReview] = useState(false);

  const rows = useMemo(() => (snapshot ? debtRows(snapshot, filter, onDate) : null), [snapshot, filter, onDate]);
  const totals = rows && snapshot ? debtTotals(debtRows(snapshot, 'all', onDate)) : null;
  const bankLoans = useMemo(() => snapshot?.accounts.filter((a) => a.type === 'loan' && !a.archived) ?? [], [snapshot]);
  const moneyBackCount = useMemo(() => (snapshot ? listMoneyBackReview(snapshot, onDate).length : 0), [snapshot, onDate]);

  const payRow =
    paymentParam && snapshot ? debtRows(snapshot, 'all', onDate).find((r) => r.debt.id === paymentParam) ?? null : null;
  const scheduleDebt =
    snapshot && (scheduleParam || pendingScheduleId)
      ? snapshot.debts.find((d) => d.id === (scheduleParam ?? pendingScheduleId)) ?? null
      : null;

  const setListTab = (f: DebtFilter) => {
    router.setParams({ [DEBT_URL.tab]: filterToDebtsListTab(f) });
  };

  async function saveListPayment(
    debt: PersonDebt,
    input: { accountId: string; principal: bigint; interest: bigint; date: string; force?: boolean; overpayment?: 'gift' | 'credit' },
  ) {
    setError(null);
    const dup = snapshot ? findRecentPayment(debt.id, snapshot, input.principal, input.date) : null;
    if (dup && !input.force) {
      setDuplicateConfirm(input);
      return;
    }
    const r = await repo.recordDebtPayment(debt.id, {
      accountId: input.accountId,
      amount: input.principal,
      date: input.date,
      interest: input.interest,
      overpayment: input.overpayment,
    });
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      toast.show(t('debts.paymentRecorded'));
      router.setParams({ [DEBT_URL.payment]: undefined });
    }
  }

  const emptyCopy =
    filter === 'owedToMe' ? t('debts.emptyOwed') : filter === 'iOwe' ? t('debts.emptyOwe') : filter === 'settled' ? t('debts.emptySettled') : t('debts.emptyBody');

  return (
    <AppFrame title={t('debts.title')}>
      {totals ? (
        <View testID="debts-summary" style={{ flexDirection: 'row', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
          <SummaryTile label={t('debts.theyOwe')} amount={totals.owedToMe} />
          <SummaryTile label={t('debts.iOwe')} amount={totals.iOwe} />
          <SummaryTile label={t('debts.net')} amount={totals.net} emphasize />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
        {FILTERS.map((f) => (
          <Button
            key={f}
            testID={`debts-filter-${f}`}
            kind={filter === f ? 'primary-pill' : 'secondary'}
            label={t(`debts.filter.${f}`)}
            onPress={() => setListTab(f)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
        <Button
          testID="debts-lent"
          label={t('debts.iLent')}
          onPress={() =>
            router.setParams({ [DEBT_URL.debt]: 'new', [DEBT_URL.tab]: 'owed', [DEBT_URL.direction]: 'lent' })
          }
        />
        <Button
          testID="debts-borrowed"
          kind="secondary"
          label={t('debts.iBorrowed')}
          onPress={() =>
            router.setParams({ [DEBT_URL.debt]: 'new', [DEBT_URL.tab]: 'owe', [DEBT_URL.direction]: 'borrowed' })
          }
        />
      </View>
      {moneyBackCount > 0 ? (
        <Card testID="debts-money-back-banner" style={{ marginBottom: sp['spacing-md'], gap: sp['spacing-sm'] }}>
          <Text>{t('debts.moneyBack.banner', { count: String(moneyBackCount) })}</Text>
          <Button testID="debts-money-back-review" kind="secondary" label={t('debts.moneyBack.review')} onPress={() => setMoneyBackReview(true)} />
        </Card>
      ) : null}
      {error ? <InlineError message={error} /> : null}
      <View
        testID={masterDetail ? 'debts-master-detail' : 'debts-list-only'}
        style={{ flex: 1, flexDirection: masterDetail ? 'row' : 'column', gap: sp['spacing-md'] }}
      >
        <View style={{ flex: masterDetail ? 1 : undefined, minWidth: 0 }}>
          {!rows ? (
            <Placeholder height={120} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={t('debts.emptyTitle')}
              body={emptyCopy}
              actionLabel={t('debts.iLent')}
              onAction={() =>
                router.setParams({ [DEBT_URL.debt]: 'new', [DEBT_URL.tab]: 'owed', [DEBT_URL.direction]: 'lent' })
              }
            />
          ) : (
            <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
              {rows.map(({ debt, balance }) => {
                const original = snapshot ? debtOriginalAmount(debt.id, snapshot) : 0n;
                const progress = snapshot ? debtProgress(debt.id, snapshot, balance) : 0;
                const pct = Math.round(progress * 100);
                const next = snapshot ? nextInstallment(debt, snapshot, onDate) : null;
                const overdue = snapshot ? debtIsOverdue(debt, snapshot, onDate) : false;
                const closed = snapshot && debt.status !== 'open' ? debtClosedDate(debt.id, snapshot) : undefined;
                const openRow = () => {
                  if (masterDetail) router.setParams({ [DEBT_URL.view]: debt.id });
                  else router.push(`/debts/${debt.id}`);
                };
                return (
                  <Card
                    key={debt.id}
                    testID={`debt-row-${debt.id}`}
                    style={{ gap: sp['spacing-sm'], opacity: debt.status !== 'open' ? 0.72 : 1 }}
                  >
                    <Pressable accessibilityRole="button" onPress={openRow}>
                      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], alignItems: 'center' }}>
                        <View
                          testID={`debt-avatar-${debt.id}`}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: tokens.radius['rounded-md'],
                            backgroundColor: theme.tagFill,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text variant="caption" style={{ color: theme.tagText }}>
                            {debtInitials(debt.name)}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text variant="heading-sm">{debt.name}</Text>
                            {overdue ? <StatusPill kind="problem" label={t('debts.overdue')} /> : null}
                            {debt.status === 'written_off' ? (
                              <StatusPill kind="problem" label={t('debts.writtenOff')} />
                            ) : null}
                          </View>
                          <Text tone="textSecondary">
                            {debt.direction === 'owedToMe' ? t('debts.theyOweLabel') : t('debts.iOweLabel')}
                          </Text>
                          {original > 0n ? (
                            <Text tone="textSecondary">
                              <Amount minor={balance} variant="caption" /> {t('debts.of')}{' '}
                              <Amount minor={original} variant="caption" />
                            </Text>
                          ) : (
                            <Amount minor={balance} />
                          )}
                          {original > 0n ? (
                            <View style={{ gap: sp['spacing-xs'] }}>
                              <View
                                style={{
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: theme.border,
                                  overflow: 'hidden',
                                }}
                              >
                                <View
                                  style={{
                                    height: 8,
                                    width: `${pct}%`,
                                    backgroundColor: theme.primaryFill,
                                  }}
                                />
                              </View>
                              <Text testID={`debt-progress-${debt.id}`} variant="caption" tone="textSecondary">
                                {debt.direction === 'owedToMe'
                                  ? t('debts.percentBack', { pct: String(pct) })
                                  : t('debts.percentPaid', { pct: String(pct) })}
                              </Text>
                            </View>
                          ) : null}
                          {next ? (
                            <Text variant="caption" tone="textSecondary">
                              {t('debts.dueLabel', { date: formatDay(next.dueDate) })}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                    {debt.status === 'open' ? (
                      <Button
                        testID={`debt-pay-${debt.id}`}
                        kind="secondary"
                        label={t('debts.recordPayment')}
                        onPress={() => router.setParams({ [DEBT_URL.payment]: debt.id })}
                      />
                    ) : (
                      <Text testID={`debt-closed-${debt.id}`} variant="caption" tone="textSecondary">
                        {debt.status === 'written_off'
                          ? closed
                            ? t('debts.writtenOffOn', { date: formatDay(closed) })
                            : t('debts.writtenOff')
                          : closed
                            ? t('debts.settledOn', { date: formatDay(closed) })
                            : t('debts.settled')}
                      </Text>
                    )}
                  </Card>
                );
              })}
              {bankLoans.length > 0 ? (
                <Card testID="debts-bank-loans" style={{ gap: sp['spacing-sm'] }}>
                  <Text variant="heading-sm">{t('debts.bankLoansTitle')}</Text>
                  <Text tone="textSecondary">{t('debts.bankLoansBody')}</Text>
                  {bankLoans.map((a) => (
                    <Pressable
                      key={a.id}
                      testID={`debts-bank-${a.id}`}
                      accessibilityRole="link"
                      onPress={() => router.push(`/accounts/${a.id}`)}
                    >
                      <Text>{a.name}</Text>
                    </Pressable>
                  ))}
                </Card>
              ) : null}
            </ScrollView>
          )}
        </View>
        {masterDetail && viewId ? (
          <View style={{ flex: 1.2, minWidth: 0, borderLeftWidth: 1, borderLeftColor: theme.border, paddingLeft: sp['spacing-md'] }}>
            <DebtScreen embeddedId={viewId} />
          </View>
        ) : null}
      </View>
      {lendOpen && snapshot ? (
        <OpenDebtSheet
          direction={openDirection}
          snapshot={snapshot}
          onClose={() =>
            router.setParams({ [DEBT_URL.debt]: undefined, [DEBT_URL.direction]: undefined })
          }
          onSave={async (input) => {
            setError(null);
            const r = await repo.openPersonDebt(input);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('debts.loanRecorded'));
            router.setParams({ [DEBT_URL.debt]: undefined, [DEBT_URL.direction]: undefined });
            if (input.payBack === 'instalments' && r.ok) {
              setPendingScheduleId(r.value.id);
              router.setParams({ [DEBT_URL.debtSchedule]: r.value.id });
            }
          }}
        />
      ) : null}
      {payRow && snapshot ? (
        <DebtsPaymentSheet
          debt={payRow.debt}
          max={payRow.balance}
          snapshot={snapshot}
          onClose={() => router.setParams({ [DEBT_URL.payment]: undefined })}
          onSave={(input) => saveListPayment(payRow.debt, input)}
        />
      ) : null}
      {scheduleDebt && snapshot ? (
        <DebtScheduleSheet
          debt={scheduleDebt}
          totalMinor={debtOriginalAmount(scheduleDebt.id, snapshot)}
          onClose={() => {
            setPendingScheduleId(null);
            router.setParams({ [DEBT_URL.debtSchedule]: undefined });
          }}
          onSave={async (input) => {
            await repo.updatePersonDebt(
              {
                ...scheduleDebt,
                scheduleInstallmentCount: input.count,
                scheduleAmountMinor: input.amountMinor.toString(),
                scheduleEvery: input.every,
                scheduleFirstDue: input.firstDue,
                nextDueDate: input.firstDue,
              },
              'schedule',
            );
            toast.show(t('debts.scheduleSaved'));
            setPendingScheduleId(null);
            router.setParams({ [DEBT_URL.debtSchedule]: undefined });
          }}
        />
      ) : null}
      <Confirm
        visible={duplicateConfirm !== null && payRow !== null}
        title={t('debts.duplicateTitle')}
        body={t('debts.duplicateBody', { date: duplicateConfirm?.date ?? onDate })}
        confirmLabel={t('debts.duplicateConfirm')}
        onConfirm={() => {
          if (!duplicateConfirm || !payRow) return;
          void saveListPayment(payRow.debt, { ...duplicateConfirm, force: true });
          setDuplicateConfirm(null);
        }}
        onCancel={() => setDuplicateConfirm(null)}
      />
      {moneyBackReview ? <MoneyBackReviewSheet onClose={() => setMoneyBackReview(false)} /> : null}
    </AppFrame>
  );
}

function SummaryTile({ label, amount, emphasize }: { label: string; amount: bigint; emphasize?: boolean }) {
  return (
    <Card style={{ flex: 1, gap: sp['spacing-xs'], minWidth: 100 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Amount minor={amount} variant={emphasize ? 'heading-sm' : 'body-tabular'} />
    </Card>
  );
}
