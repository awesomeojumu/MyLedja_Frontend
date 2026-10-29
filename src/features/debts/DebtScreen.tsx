import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';

import {
  Amount,
  Button,
  Card,
  Confirm,
  formatDay,
  Icon,
  InlineError,
  Menu,
  Placeholder,
  SegmentedControl,
  Sheet,
  StatusPill,
  Text,
  TextInput,
  useToast,
  type MenuItem,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { DebtEditSheet, DebtsPaymentSheet } from './DebtsPaymentSheet';
import { DebtScheduleSheet } from './DebtScheduleSheet';
import { debtInterestTotal, debtRows, findRecentPayment } from './helpers';
import { DEBT_URL, parseDebtDetailTab, type DebtDetailTab } from './popupUrl';
import {
  debtOriginalAmount,
  debtProgress,
  debtScheduleRows,
  nextInstallment,
  payoffByDate,
  reminderMessage,
  timelineKindLabel,
} from './schedule';

const sp = tokens.spacing;

function statusPillFor(status: 'paid' | 'due' | 'overdue' | 'upcoming') {
  if (status === 'paid') return { kind: 'done' as const, label: t('debts.statusPaid') };
  if (status === 'overdue') return { kind: 'problem' as const, label: t('debts.statusOverdue') };
  if (status === 'due') return { kind: 'due-soon' as const, label: t('debts.statusDueSoon') };
  return { kind: 'pending' as const, label: t('debts.statusScheduled') };
}

export function DebtScreen() {
  const { id, tab: tabParam, payment, debtSchedule } = useLocalSearchParams<{ id: string; tab?: string; payment?: string; debtSchedule?: string }>();
  const router = useRouter();
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const onDate = today();

  const tab = parseDebtDetailTab(typeof tabParam === 'string' ? tabParam : undefined);
  const payOpen = payment === id;
  const scheduleOpen = debtSchedule === id;
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ accountId: string; principal: bigint; interest: bigint; date: string; overpayment?: 'gift' | 'credit' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const row = useMemo(() => {
    if (!snapshot || !id) return null;
    return debtRows(snapshot, 'all', onDate).find((r) => r.debt.id === id) ?? null;
  }, [snapshot, id, onDate]);

  const entries = useMemo(() => {
    if (!snapshot || !id) return [];
    return snapshot.debtEntries.filter((e) => e.debtId === id).sort((a, b) => b.date.localeCompare(a.date));
  }, [snapshot, id]);

  const interestTotal = row && snapshot ? debtInterestTotal(row.debt, snapshot) : 0n;
  const original = row && snapshot ? debtOriginalAmount(row.debt.id, snapshot) : 0n;
  const progress = row && snapshot ? debtProgress(row.debt.id, snapshot, row.balance) : 0;
  const schedule = row && snapshot ? debtScheduleRows(row.debt, snapshot, onDate) : [];
  const next = row && snapshot ? nextInstallment(row.debt, snapshot, onDate) : null;
  const payoffDate = row && snapshot ? payoffByDate(row.debt, snapshot) : null;

  if (!row) {
    return (
      <AppFrame title={t('debts.detailTitle')}>
        <Placeholder height={120} />
      </AppFrame>
    );
  }

  const { debt, balance } = row;
  const directionLabel = debt.direction === 'owedToMe' ? t('debts.theyOweLabel') : t('debts.iOweLabel');
  const recordLabel = debt.direction === 'owedToMe' ? t('debts.recordMoneyBack') : t('debts.recordPayment');

  const sendReminder = async () => {
    const polite = reminderMessage(debt, balance, next);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(polite);
        toast.show(t('debts.reminderCopied'));
        return;
      }
      await Share.share({ message: polite });
    } catch {
      toast.show(t('debts.reminderCopied'));
    }
  };

  const menuItems: MenuItem[] = [
    { key: 'edit', label: t('debts.menuEdit'), onPress: () => setEditOpen(true) },
    { key: 'schedule', label: t('debts.menuSchedule'), onPress: () => router.setParams({ [DEBT_URL.debtSchedule]: id }) },
  ];
  if (debt.status === 'open') {
    menuItems.push({ key: 'settle', label: t('debts.menuSettled'), onPress: () => void markSettled() });
  }
  if (debt.direction === 'owedToMe' && debt.status === 'open') {
    menuItems.push({ key: 'writeoff', label: t('debts.writeOff'), onPress: () => setWriteOffOpen(true) });
  }

  async function markSettled() {
    setError(null);
    const r = await repo.markPersonDebtSettled(debt.id);
    if (!r.ok) setError(ledgerMessage(r.error));
    else toast.show(t('debts.markedSettled'));
  }

  async function savePayment(input: { accountId: string; principal: bigint; interest: bigint; date: string; force?: boolean; overpayment?: 'gift' | 'credit' }) {
    setError(null);
    const dup = findRecentPayment(debt.id, snapshot!, input.principal, input.date);
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

  const changeTab = (next: DebtDetailTab) => {
    router.setParams({ [DEBT_URL.tab]: next });
  };

  const timelineBlock = (
    <View style={{ flex: 1, gap: sp['spacing-sm'] }}>
      <Text variant="heading-sm">{t('debts.timeline')}</Text>
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          testID={`debt-timeline-${entry.id}`}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/transactions', params: { tx: entry.eventId } })}
        >
          <Card style={{ gap: sp['spacing-xs'] }}>
            <Text variant="caption" tone="textSecondary">
              {formatDay(entry.date)} · {timelineKindLabel(entry.kind)}
            </Text>
            <Amount minor={BigInt(entry.amountMinor)} variant="caption" />
            {entry.interestMinor ? (
              <Text variant="caption" tone="textSecondary">
                {t('debts.principalAmount')}{' '}
                <Amount minor={BigInt(entry.amountMinor)} variant="caption" /> · {t('debts.interestLine')}{' '}
                <Amount minor={BigInt(entry.interestMinor)} variant="caption" />
              </Text>
            ) : null}
            {entry.note ? (
              <Text variant="caption" tone="textSecondary">
                {entry.note}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </View>
  );

  const scheduleBlock = (
    <View style={{ flex: 1, gap: sp['spacing-sm'] }}>
      <Text variant="heading-sm">{t('debts.scheduleTab')}</Text>
      {schedule.length === 0 ? (
        <View style={{ gap: sp['spacing-sm'] }}>
          <Text tone="textSecondary">{t('debts.scheduleEmpty')}</Text>
          <Button testID="debt-add-schedule" kind="secondary" label={t('debts.addSchedule')} onPress={() => router.setParams({ [DEBT_URL.debtSchedule]: id })} />
        </View>
      ) : (
        schedule.map((inst) => {
          const pill = statusPillFor(inst.status);
          return (
            <View key={inst.dueDate} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sp['spacing-sm'] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], flex: 1 }}>
                <Text variant="caption" tone="textSecondary">
                  {formatDay(inst.dueDate)}
                </Text>
                <StatusPill kind={pill.kind} label={pill.label} />
              </View>
              <Amount minor={inst.amountMinor} variant="caption" />
            </View>
          );
        })
      )}
      {interestTotal > 0n ? (
        <Text variant="caption" tone="textSecondary">
          {debt.direction === 'owedToMe' ? t('debts.interestEarned') : t('debts.interestPaid')}: <Amount minor={interestTotal} variant="caption" />
        </Text>
      ) : null}
      {payoffDate ? (
        <Text variant="caption" tone="textSecondary">
          {t('debts.payoffBy', { date: formatDay(payoffDate) })}
        </Text>
      ) : null}
    </View>
  );

  const chartBlock =
    schedule.length > 0 ? (
      <Card testID="debt-payoff-chart" style={{ gap: sp['spacing-xs'], marginTop: sp['spacing-md'] }}>
        <Text variant="heading-sm">{t('debts.payoffChart')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 48 }}>
          {schedule.slice(0, 12).map((inst, i) => {
            const h = Math.max(8, Math.round(((schedule.length - i) / schedule.length) * 40));
            return (
              <View
                key={inst.dueDate}
                style={{
                  flex: 1,
                  height: h,
                  backgroundColor: inst.status === 'paid' ? theme.border : theme.primaryFill,
                  borderRadius: 2,
                }}
              />
            );
          })}
        </View>
      </Card>
    ) : null;

  return (
    <AppFrame title={debt.name}>
      <Card style={{ marginBottom: sp['spacing-md'], gap: sp['spacing-xs'] }}>
        <Text tone="textSecondary">{directionLabel}</Text>
        <Text variant="caption" tone="textSecondary">
          <Amount minor={balance} variant="caption" /> {t('debts.leftOf')}{' '}
          <Amount minor={original} variant="caption" />
        </Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${Math.round(progress * 100)}%`, backgroundColor: theme.primaryFill }} />
        </View>
        {next ? (
          <Text variant="caption" tone="textSecondary">
            {t('debts.nextDue', { amount: formatNaira(next.amountMinor), date: formatDay(next.dueDate) })}
          </Text>
        ) : debt.status === 'settled' ? (
          <Text variant="caption" tone="textSecondary">
            {t('debts.settled')}
          </Text>
        ) : null}
        {interestTotal > 0n ? (
          <Text variant="caption" tone="textSecondary">
            {debt.direction === 'owedToMe' ? t('debts.interestEarned') : t('debts.interestPaid')}: <Amount minor={interestTotal} variant="caption" />
          </Text>
        ) : null}
      </Card>
      {error ? <InlineError message={error} /> : null}
      {debt.status === 'open' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'], alignItems: 'center' }}>
          <Button testID="debt-record-payment" label={recordLabel} onPress={() => router.setParams({ [DEBT_URL.payment]: id })} />
          {debt.direction === 'owedToMe' ? (
            <Button testID="debt-send-reminder" kind="secondary" label={t('debts.sendReminder')} onPress={() => void sendReminder()} />
          ) : null}
          <Menu
            testID="debt-menu"
            trigger={(open) => (
              <Pressable
                testID="debt-more"
                accessibilityRole="button"
                accessibilityLabel={t('common.options')}
                onPress={open}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.inputBorder, borderRadius: tokens.radius['rounded-pill'], paddingHorizontal: sp['spacing-md'] }}
              >
                <Icon icon={MoreHorizontal} size="nav" color={theme.textSecondary} />
              </Pressable>
            )}
            items={menuItems}
          />
        </View>
      ) : null}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: sp['spacing-lg'] }}>
          {timelineBlock}
          {scheduleBlock}
        </View>
      ) : (
        <>
          <SegmentedControl
            testID="debt-detail-tabs"
            label={t('debts.detailTabs')}
            options={[
              { value: 'timeline', label: t('debts.timeline') },
              { value: 'schedule', label: t('debts.scheduleTab') },
            ]}
            value={tab}
            onChange={changeTab}
          />
          <ScrollView contentContainerStyle={{ paddingTop: sp['spacing-md'], gap: sp['spacing-md'] }}>
            {tab === 'timeline' ? timelineBlock : scheduleBlock}
            {chartBlock}
          </ScrollView>
        </>
      )}
      {wide ? chartBlock : null}
      {payOpen && snapshot ? (
        <DebtsPaymentSheet
          debt={debt}
          max={balance}
          snapshot={snapshot}
          onClose={() => router.setParams({ [DEBT_URL.payment]: undefined })}
          onSave={savePayment}
        />
      ) : null}
      {scheduleOpen ? (
        <DebtScheduleSheet
          debt={debt}
          totalMinor={original > 0n ? original : balance}
          onClose={() => router.setParams({ [DEBT_URL.debtSchedule]: undefined })}
          onSave={async (input) => {
            setError(null);
            await repo.updatePersonDebt({
              ...debt,
              scheduleInstallmentCount: input.count,
              scheduleAmountMinor: input.amountMinor.toString(),
              scheduleEvery: input.every,
              scheduleFirstDue: input.firstDue,
              nextDueDate: input.firstDue,
            });
            toast.show(t('debts.scheduleSaved'));
            router.setParams({ [DEBT_URL.debtSchedule]: undefined });
          }}
        />
      ) : null}
      {editOpen ? (
        <DebtEditSheet
          debt={debt}
          onClose={() => setEditOpen(false)}
          onSave={async (input) => {
            await repo.updatePersonDebt({ ...debt, name: input.name, notes: input.notes || undefined });
            toast.show(t('common.saved'));
            setEditOpen(false);
          }}
        />
      ) : null}
      {writeOffOpen ? (
        <WriteOffSheet
          max={balance}
          onClose={() => setWriteOffOpen(false)}
          onSave={async (reason) => {
            setError(null);
            const r = await repo.writeOffDebt(debt.id, { amount: balance, date: onDate, reason });
            if (!r.ok) setError(ledgerMessage(r.error));
            else setWriteOffOpen(false);
          }}
        />
      ) : null}
      <Confirm
        visible={duplicateConfirm !== null}
        title={t('debts.duplicateTitle')}
        body={t('debts.duplicateBody', { date: duplicateConfirm?.date ?? onDate })}
        confirmLabel={t('debts.duplicateConfirm')}
        onConfirm={() => {
          if (!duplicateConfirm) return;
          void savePayment({ ...duplicateConfirm, force: true });
          setDuplicateConfirm(null);
        }}
        onCancel={() => setDuplicateConfirm(null)}
      />
    </AppFrame>
  );
}

function WriteOffSheet({ max, onClose, onSave }: { max: bigint; onClose: () => void; onSave: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet
      visible
      title={t('debts.writeOffTitle')}
      onClose={onClose}
      testID="debt-writeoff-sheet"
      footer={<Button testID="debt-writeoff-save" label={t('debts.writeOffConfirm')} disabled={!reason.trim()} onPress={() => void onSave(reason)} />}
    >
      <Text tone="textSecondary">{t('debts.writeOffCaption')}</Text>
      <Amount minor={max} />
      <TextInput testID="debt-writeoff-reason" label={t('debts.writeOffReason')} value={reason} onChangeText={setReason} />
    </Sheet>
  );
}
