import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DebtInterest, PersonDebt } from '@/data/workspace/model';
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
  RedesignSegmented,
  RedesignSheet,
  RedesignText,
  RedesignTopBar,
  RedesignShell,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { formatNaira, parseAmount } from '@/money';
import { today } from '@/features/transactions/helpers';

import { debtInitials, debtRows, type DebtRow } from './helpers';
import { addMonths, debtOriginalAmount } from './schedule';

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

type PayOrder = 'smallest' | 'interest' | 'custom';
type DebtKind = 'loan' | 'card' | 'person';

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

function dayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** Annual % from stored monthly interest (Figma shows “% a year”). */
function annualPercent(interest?: DebtInterest): number | null {
  if (!interest || interest.kind === 'none') return null;
  if (interest.kind === 'percent_month') return Math.round(interest.percent * 12 * 10) / 10;
  return null;
}

function monthlyFromSchedule(debt: PersonDebt): bigint | null {
  if (!debt.scheduleAmountMinor) return null;
  const n = BigInt(debt.scheduleAmountMinor);
  return n > 0n ? n : null;
}

function rowCaption(debt: PersonDebt): string {
  const pct = annualPercent(debt.interest);
  const monthly = monthlyFromSchedule(debt);
  const next = debt.nextDueDate ? dayMonth(debt.nextDueDate) : null;
  if (pct == null && monthly == null && next) return t('debts.redesign.noInterestNext', { when: next });
  if (pct == null && next) return t('debts.redesign.nextOnly', { when: next });
  if (pct != null && monthly != null) {
    // Cards often show “minimum”; loans show “a month”.
    const asMin = (debt.notes ?? '').toLowerCase().includes('card') || debt.name.toLowerCase().includes('card');
    return asMin
      ? t('debts.redesign.interestYearMin', { pct: String(pct), amount: formatNaira(monthly) })
      : t('debts.redesign.interestYearMonth', { pct: String(pct), amount: formatNaira(monthly) });
  }
  if (pct != null) return t('debts.redesign.interestYear', { pct: String(pct) });
  if (next) return t('debts.redesign.nextOnly', { when: next });
  return t('debts.redesign.noInterest');
}

function sortRows(rows: DebtRow[], order: PayOrder): DebtRow[] {
  const copy = [...rows];
  if (order === 'smallest') {
    return copy.sort((a, b) => (a.balance === b.balance ? 0 : a.balance < b.balance ? -1 : 1));
  }
  if (order === 'interest') {
    return copy.sort((a, b) => {
      const ap = annualPercent(a.debt.interest) ?? -1;
      const bp = annualPercent(b.debt.interest) ?? -1;
      if (bp !== ap) return bp - ap;
      return a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1;
    });
  }
  // My own order — keep helper’s default (overdue / due / balance).
  return copy;
}

function debtFreeIso(total: bigint, monthlyPace: bigint, fromIso: string): string | null {
  if (total <= 0n || monthlyPace <= 0n) return null;
  const months = Number(total / monthlyPace + (total % monthlyPace > 0n ? 1n : 0n));
  return addMonths(fromIso, Math.max(1, months));
}

/** Figma Mobile: Phone / Debts (4:2228) + empty / add. */
export function RedesignDebtsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { snapshot, repo } = useWorkspace();
  const todayIso = today();
  const [order, setOrder] = useState<PayOrder>('smallest');
  const [addOpen, setAddOpen] = useState(false);

  const iOwe = snapshot ? debtRows(snapshot, 'iOwe', todayIso) : [];
  const sorted = sortRows(iOwe, order);
  const totalOwed = iOwe.reduce((s, r) => s + r.balance, 0n);
  const totalOriginal = snapshot
    ? iOwe.reduce((s, r) => s + debtOriginalAmount(r.debt.id, snapshot), 0n)
    : 0n;
  const paid = totalOriginal > totalOwed ? totalOriginal - totalOwed : 0n;
  const monthlyPace = iOwe.reduce((s, r) => s + (monthlyFromSchedule(r.debt) ?? 0n), 0n);
  const freeBy = debtFreeIso(totalOwed, monthlyPace, todayIso);

  return (
    <RedesignShell><SafeAreaView testID="redesign-debts" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <RedesignTopBar
        title={t('debts.title')}
        onBack={() => router.push('/more')}
        trailing={
          <Pressable
            testID="debts-redesign-add"
            accessibilityRole="button"
            accessibilityLabel={t('debts.redesign.addADebt')}
            onPress={() => setAddOpen(true)}
            style={{
              width: tokens.density.touch.minTarget,
              height: tokens.density.touch.minTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RedesignIcon name="plus" size={24} color={theme.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: sp.xxl }}>
        {iOwe.length === 0 ? (
          <Card testID="debts-redesign-empty">
            <View style={{ alignItems: 'center', gap: sp.md, padding: sp.xl }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RedesignIcon name="list" size={28} color={theme.text} />
              </View>
              <RedesignText variant="headline" accessibilityRole="header">
                {t('debts.redesign.emptyTitle')}
              </RedesignText>
              <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                {t('debts.redesign.emptyBody')}
              </RedesignText>
              <RedesignButton
                testID="debts-redesign-empty-add"
                label={t('debts.redesign.addADebt')}
                onPress={() => setAddOpen(true)}
              />
            </View>
          </Card>
        ) : (
          <>
            <Card testID="debts-redesign-total">
              <View style={{ padding: sp.lg, gap: sp.sm }}>
                <RedesignText variant="label" tone="textSecondary">
                  {t('debts.redesign.youOwe')}
                </RedesignText>
                <RedesignAmount testID="debts-redesign-total-amount" text={formatNaira(totalOwed)} sizeVariant="display" />
                <RedesignText>
                  {freeBy
                    ? t('debts.redesign.debtFreeBy', { when: monthYear(freeBy) })
                    : t('debts.redesign.debtFreeUnknown')}
                </RedesignText>
                {totalOriginal > 0n ? (
                  <RedesignProgress testID="debts-redesign-progress" value={Number(paid)} max={Number(totalOriginal)} />
                ) : null}
              </View>
            </Card>

            <View style={{ gap: sp.sm }}>
              <RedesignText variant="label" tone="textSecondary">
                {t('debts.redesign.payOffOrder')}
              </RedesignText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm }}>
                {(
                  [
                    ['smallest', t('debts.redesign.smallestFirst')],
                    ['interest', t('debts.redesign.highestInterest')],
                    ['custom', t('debts.redesign.myOwnOrder')],
                  ] as const
                ).map(([key, label]) => {
                  const on = order === key;
                  return (
                    <Pressable
                      key={key}
                      testID={`debts-order-${key}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setOrder(key)}
                      style={{
                        paddingHorizontal: sp.md,
                        paddingVertical: sp.sm,
                        borderRadius: shape['radius-pill'],
                        borderWidth: 1,
                        borderColor: on ? theme.primary : theme.border,
                        backgroundColor: on ? theme.primary : theme.surface,
                        minHeight: tokens.density.touch.minTarget,
                        justifyContent: 'center',
                      }}
                    >
                      <RedesignText variant="label" style={{ color: on ? theme.textOnPrimary : theme.text }}>
                        {label}
                      </RedesignText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Card testID="debts-redesign-list">
              {sorted.map(({ debt, balance }) => (
                <Pressable
                  key={debt.id}
                  testID={`debt-row-${debt.id}`}
                  accessibilityRole="button"
                  onPress={() => router.push(`/debts/${debt.id}`)}
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
                    <RedesignText variant="label">{debtInitials(debt.name).slice(0, 1)}</RedesignText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <RedesignText variant="label">{debt.name}</RedesignText>
                    <RedesignText variant="helper" tone="textSecondary">
                      {rowCaption(debt)}
                    </RedesignText>
                  </View>
                  <RedesignAmount text={formatNaira(balance)} sizeVariant="amount" />
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {addOpen && snapshot ? (
        <AddDebtSheet
          snapshot={snapshot}
          onClose={() => setAddOpen(false)}
          onSave={async (input) => {
            const r = await repo.openPersonDebt(input);
            if (r.ok) {
              if (input.monthly && input.monthly > 0n) {
                await repo.updatePersonDebt({
                  ...r.value,
                  scheduleAmountMinor: input.monthly.toString(),
                  scheduleEvery: 'month',
                  scheduleFirstDue: input.dueDate,
                });
              }
              toast.show(t('debts.redesign.debtSaved'));
              setAddOpen(false);
            }
          }}
        />
      ) : null}
    </SafeAreaView></RedesignShell>
  );
}

function AddDebtSheet({
  snapshot,
  onClose,
  onSave,
}: {
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: {
    name: string;
    direction: PersonDebt['direction'];
    accountId: string;
    amount: bigint;
    date: string;
    interest?: DebtInterest;
    dueDate?: string;
    monthly?: bigint;
    notes?: string;
  }) => Promise<void>;
}) {
  const [kind, setKind] = useState<DebtKind>('loan');
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [interestText, setInterestText] = useState('');
  const [monthlyText, setMonthlyText] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const accountId = snapshot.accounts.find((a) => !a.archived)?.id ?? '';

  return (
    <RedesignSheet
      testID="debts-redesign-add-sheet"
      visible
      title={t('debts.redesign.addDebtTitle')}
      onClose={onClose}
      dirty={!!name || !!amountText || !!interestText || !!monthlyText}
      footer={
        <RedesignButton
          testID="debts-redesign-save"
          label={t('debts.redesign.addDebt')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            if (!name.trim()) {
              setError(t('debts.redesign.namePlaceholder'));
              return;
            }
            const parsed = parseAmount(amountText);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('debts.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('debts.redesign.namePlaceholder'));
              return;
            }
            let interest: DebtInterest | undefined = { kind: 'none' };
            const yearPct = Number(interestText.replace(/%/g, '').trim());
            if (interestText.trim() && Number.isFinite(yearPct) && yearPct > 0) {
              interest = { kind: 'percent_month', percent: yearPct / 12 };
            }
            const monthly = monthlyText.trim() ? parseAmount(monthlyText) : null;
            if (monthlyText.trim() && (!monthly || !monthly.ok || monthly.minor <= 0n)) {
              setError(t('debts.redesign.amountHint'));
              return;
            }
            setSaving(true);
            void onSave({
              name: name.trim(),
              direction: 'iOwe',
              accountId,
              amount: parsed.minor,
              date: today(),
              interest,
              dueDate: nextDate.trim() || undefined,
              monthly: monthly && monthly.ok ? monthly.minor : undefined,
              notes: kind === 'card' ? 'card' : kind === 'person' ? 'person' : 'loan',
            }).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignSegmented
          testID="debts-redesign-kind"
          value={kind}
          onChange={(k) => setKind(k as DebtKind)}
          options={[
            { key: 'loan', label: t('debts.redesign.kindLoan') },
            { key: 'card', label: t('debts.redesign.kindCard') },
            { key: 'person', label: t('debts.redesign.kindPerson') },
          ]}
        />
        <RedesignField
          testID="debts-redesign-name"
          label={t('debts.redesign.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('debts.redesign.namePlaceholder')}
        />
        <RedesignField
          testID="debts-redesign-amount"
          label={t('debts.redesign.amountLeft')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignText variant="helper" tone="textSecondary">
          {t('debts.redesign.amountHint')}
        </RedesignText>
        <RedesignField
          testID="debts-redesign-interest"
          label={t('debts.redesign.interestYearLabel')}
          value={interestText}
          onChangeText={setInterestText}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <RedesignField
          testID="debts-redesign-monthly"
          label={t('debts.redesign.monthlyPayment')}
          value={monthlyText}
          onChangeText={setMonthlyText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignField
          testID="debts-redesign-next"
          label={t('debts.redesign.nextPayment')}
          value={nextDate}
          onChangeText={setNextDate}
          placeholder={t('debts.redesign.pickDate')}
        />
        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}
