import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignButton,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignProgress,
  RedesignSheet,
  RedesignText,
  RedesignTopBar,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { formatNaira, parseAmount } from '@/money';
import { today } from '@/features/transactions/helpers';

import { debtRows } from './helpers';
import { addMonths, debtOriginalAmount, payoffByDate } from './schedule';

const sp = tokens.space;
const shape = tokens.shape;

const MONTH_LONG = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `${MONTH_LONG[m] ?? m} ${y}`;
}

function monthName(iso: string): string {
  const m = Number(iso.slice(5, 7));
  return MONTH_LONG[m] ?? iso;
}

function dayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function annualPercent(interest: { kind: string; percent?: number } | undefined): number | null {
  if (!interest || interest.kind === 'none') return null;
  if (interest.kind === 'percent_month' && typeof interest.percent === 'number') {
    return Math.round(interest.percent * 12 * 10) / 10;
  }
  return null;
}

function cashAccountForEvent(eventId: string, snapshot: Snapshot): string | undefined {
  const event = snapshot.events.find((e) => e.id === eventId);
  if (!event) return undefined;
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const line = event.lines.find((l) => accountIds.has(l.ledgerAccountId));
  if (!line) return undefined;
  return snapshot.accounts.find((a) => a.id === line.ledgerAccountId)?.name;
}

function estimatePayoff(balance: bigint, monthly: bigint | null, fromIso: string): string | null {
  if (!monthly || monthly <= 0n || balance <= 0n) return null;
  const months = Number(balance / monthly + (balance % monthly > 0n ? 1n : 0n));
  return addMonths(fromIso, Math.max(1, months));
}

/** Figma Mobile: Phone / Debt (4:2290) + Record a payment (4:2354). */
export function RedesignDebtScreen({ embeddedId }: { embeddedId?: string } = {}) {
  const params = useLocalSearchParams<{ id?: string; payment?: string }>();
  const id = embeddedId ?? (typeof params.id === 'string' ? params.id : undefined);
  const router = useRouter();
  const toast = useToast();
  const { snapshot, repo } = useWorkspace();
  const todayIso = today();
  const [payOpen, setPayOpen] = useState(params.payment === id);
  const [menuOpen, setMenuOpen] = useState(false);

  const row = snapshot && id ? debtRows(snapshot, 'all', todayIso).find((r) => r.debt.id === id) ?? null : null;

  if (!snapshot || !id || !row) {
    return (
      <SafeAreaView testID="redesign-debt-loading" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar title={t('debts.detailTitle')} onBack={() => router.push('/debts')} />
      </SafeAreaView>
    );
  }

  const { debt, balance } = row;
  const original = debtOriginalAmount(debt.id, snapshot);
  const paid = original > balance ? original - balance : 0n;
  const pct = annualPercent(debt.interest);
  const monthly = debt.scheduleAmountMinor ? BigInt(debt.scheduleAmountMinor) : null;
  const nextLabel = debt.nextDueDate ? dayMonth(debt.nextDueDate) : t('debts.redesign.notSet');
  const payoff =
    payoffByDate(debt, snapshot) ?? estimatePayoff(balance, monthly && monthly > 0n ? monthly : null, todayIso);
  const payments = snapshot.debtEntries
    .filter((e) => e.debtId === debt.id && e.kind === 'payment')
    .sort((a, b) => b.date.localeCompare(a.date));

  const shell = (body: ReactNode) =>
    embeddedId ? (
      <View testID="redesign-debt" style={{ flex: 1 }}>
        {body}
      </View>
    ) : (
      <SafeAreaView testID="redesign-debt" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        {body}
      </SafeAreaView>
    );

  return shell(
    <>
      {embeddedId ? null : (
        <RedesignTopBar
          title={debt.name}
          onBack={() => router.push('/debts')}
          trailing={
            <Pressable
              testID="debt-redesign-more"
              accessibilityRole="button"
              accessibilityLabel={t('debts.redesign.more')}
              onPress={() => setMenuOpen(true)}
              style={{
                width: tokens.density.touch.minTarget,
                height: tokens.density.touch.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RedesignIcon name="more" size={22} color={theme.text} />
            </Pressable>
          }
        />
      )}

      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: 140 }}>
        <Card testID="debt-redesign-balance">
          <View style={{ padding: sp.lg, gap: sp.sm }}>
            <RedesignText variant="label" tone="textSecondary">
              {t('debts.redesign.leftToPay')}
            </RedesignText>
            <RedesignAmount testID="debt-redesign-left" text={formatNaira(balance)} sizeVariant="display" />
            {original > 0n ? (
              <>
                <RedesignText>
                  {t('debts.redesign.paidOf', { paid: formatNaira(paid), original: formatNaira(original) })}
                </RedesignText>
                <RedesignProgress testID="debt-redesign-progress" value={Number(paid)} max={Number(original)} />
              </>
            ) : null}
          </View>
        </Card>

        <Card testID="debt-redesign-details">
          {(
            [
              [
                t('debts.redesign.interest'),
                pct != null ? t('debts.redesign.interestYearValue', { pct: String(pct) }) : t('debts.redesign.noInterest'),
              ],
              [t('debts.redesign.monthlyPayment'), monthly && monthly > 0n ? formatNaira(monthly) : t('debts.redesign.notSet')],
              [t('debts.redesign.nextPayment'), nextLabel],
              [t('debts.redesign.paidOffBy'), payoff ? monthYear(payoff) : t('debts.redesign.notSet')],
            ] as const
          ).map(([label, value], i, arr) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: sp.md,
                paddingHorizontal: sp.lg,
                paddingVertical: sp.md,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <RedesignText tone="textSecondary">{label}</RedesignText>
              <RedesignText style={{ flexShrink: 1, textAlign: 'right' }}>{value}</RedesignText>
            </View>
          ))}
        </Card>

        {payments.length > 0 ? (
          <View style={{ gap: sp.xs }}>
            <RedesignText variant="label" tone="textSecondary">
              {t('debts.redesign.payments')}
            </RedesignText>
            <Card testID="debt-redesign-payments">
              {payments.map((entry) => {
                const account = cashAccountForEvent(entry.eventId, snapshot);
                const meta = account
                  ? t('debts.redesign.paymentMeta', { when: dayMonth(entry.date), account })
                  : t('debts.redesign.paymentMetaDate', { when: dayMonth(entry.date) });
                return (
                  <Pressable
                    key={entry.id}
                    testID={`debt-payment-${entry.id}`}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/transactions', params: { tx: entry.eventId } })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sp.md,
                      paddingHorizontal: sp.md,
                      paddingVertical: sp.md,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View
                      style={{
                        width: tokens.size.avatar,
                        height: tokens.size.avatar,
                        borderRadius: tokens.size.avatar / 2,
                        backgroundColor: theme.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <RedesignText variant="label">{t('debts.redesign.payments').slice(0, 1)}</RedesignText>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <RedesignText>{t('debts.redesign.paymentTitle', { month: monthName(entry.date) })}</RedesignText>
                      <RedesignText variant="helper" tone="textSecondary">
                        {meta}
                      </RedesignText>
                    </View>
                    <RedesignAmount text={formatNaira(BigInt(entry.amountMinor))} sizeVariant="amount" sign="−" />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {debt.status === 'open' ? (
        <View style={{ padding: sp.lg, backgroundColor: theme.page }}>
          <RedesignButton
            testID="debt-redesign-record"
            label={t('debts.redesign.recordPayment')}
            fullWidth
            onPress={() => setPayOpen(true)}
          />
        </View>
      ) : null}

      {payOpen ? (
        <RecordPaymentSheet
          debtName={debt.name}
          balance={balance}
          defaultAmount={monthly && monthly > 0n ? monthly : undefined}
          accounts={snapshot.accounts.filter((a) => !a.archived)}
          defaultAccountId={debt.accountId ?? snapshot.accounts.find((a) => !a.archived)?.id}
          onClose={() => setPayOpen(false)}
          onSave={async (input) => {
            const r = await repo.recordDebtPayment(debt.id, {
              accountId: input.accountId,
              amount: input.amount,
              date: input.date,
            });
            if (r.ok) {
              toast.show(t('debts.redesign.paymentSaved'));
              setPayOpen(false);
            }
          }}
        />
      ) : null}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          testID="debt-redesign-menu-scrim"
          style={{ flex: 1, backgroundColor: 'rgba(0,29,52,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: shape['radius-lg'],
              borderTopRightRadius: shape['radius-lg'],
              padding: sp.lg,
              gap: sp.sm,
            }}
          >
            <Pressable
              testID="debt-redesign-settle"
              onPress={() => {
                setMenuOpen(false);
                void repo.markPersonDebtSettled(debt.id).then((r) => {
                  if (r.ok) toast.show(t('debts.markedSettled'));
                });
              }}
              style={{ minHeight: tokens.density.touch.minTarget, justifyContent: 'center' }}
            >
              <RedesignText>{t('debts.redesign.menuSettled')}</RedesignText>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={{ minHeight: tokens.density.touch.minTarget, justifyContent: 'center' }}
            >
              <RedesignText tone="textSecondary">{t('common.cancel')}</RedesignText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>,
  );
}

function RecordPaymentSheet({
  debtName,
  balance,
  defaultAmount,
  accounts,
  defaultAccountId,
  onClose,
  onSave,
}: {
  debtName: string;
  balance: bigint;
  defaultAmount?: bigint;
  accounts: Snapshot['accounts'];
  defaultAccountId?: string;
  onClose: () => void;
  onSave: (input: { amount: bigint; accountId: string; date: string }) => Promise<void>;
}) {
  const todayIso = today();
  const [amountText, setAmountText] = useState(defaultAmount ? (Number(defaultAmount) / 100).toFixed(2) : '');
  const [accountId, setAccountId] = useState(defaultAccountId ?? '');
  const [accountOpen, setAccountOpen] = useState(false);
  const [dateText, setDateText] = useState(todayIso);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const accountName = accounts.find((a) => a.id === accountId)?.name ?? t('debts.redesign.chooseOption');
  const parsed = parseAmount(amountText);
  const leftAfter =
    parsed.ok && parsed.minor > 0n ? (parsed.minor >= balance ? 0n : balance - parsed.minor) : null;

  return (
    <RedesignSheet
      testID="debt-redesign-pay-sheet"
      visible
      title={t('debts.redesign.recordPaymentTitle')}
      onClose={onClose}
      dirty={!!amountText}
      footer={
        <RedesignButton
          testID="debt-redesign-pay-save"
          label={t('debts.redesign.savePayment')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('debts.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('debts.redesign.chooseOption'));
              return;
            }
            setSaving(true);
            void onSave({ amount: parsed.minor, accountId, date: dateText.trim() || todayIso }).finally(() =>
              setSaving(false),
            );
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignField
          testID="debt-redesign-pay-amount"
          label={t('debts.redesign.amount')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignText variant="helper" tone="textSecondary">
          {t('debts.redesign.amountHint')}
        </RedesignText>
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('debts.redesign.from')}</RedesignText>
          <Pressable
            testID="debt-redesign-pay-from"
            onPress={() => setAccountOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{accountName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {accountOpen
            ? accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setAccountId(a.id);
                    setAccountOpen(false);
                  }}
                  style={{ padding: sp.md }}
                >
                  <RedesignText>{a.name}</RedesignText>
                </Pressable>
              ))
            : null}
        </View>
        <RedesignField
          testID="debt-redesign-pay-date"
          label={t('debts.redesign.date')}
          value={dateText}
          onChangeText={setDateText}
          placeholder={t('debts.redesign.pickDate')}
        />
        {leftAfter != null ? (
          <RedesignText tone="textSecondary">
            {t('debts.redesign.afterPayment', { amount: formatNaira(leftAfter), name: debtName.toLowerCase() })}
          </RedesignText>
        ) : null}
        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}
