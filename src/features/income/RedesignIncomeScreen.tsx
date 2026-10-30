import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { IncomeStream } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignButton,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignListRow,
  RedesignProgress,
  RedesignSheet,
  RedesignText,
  RedesignTopBar,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { monthOf } from '@/ledger';
import { t } from '@/i18n';
import { formatNaira, parseAmount, toInputText } from '@/money';
import { today } from '@/features/transactions/helpers';

import {
  formatStreamSchedule,
  incomeForMonth,
  streamDueDateInMonth,
  twelveMonthIncomeSeries,
  type StreamRow,
  type TwelveMonthPoint,
} from './helpers';

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

function monthLongName(month: string): string {
  const m = Number(month.slice(5, 7));
  return MONTH_LONG[m] ?? month;
}

function shortDayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function sourceSubtitle(row: StreamRow, month: string): string {
  const { stream, expected, received } = row;
  if (stream.kind === 'variable' || stream.kind === 'irregular') return t('income.redesign.varies');
  if (received < expected) {
    const due = streamDueDateInMonth(stream, month);
    if (due) return t('income.redesign.expectedOn', { date: shortDayMonth(due) });
  }
  if (stream.rule.every === 'month') {
    const day = stream.rule.on === 0 || stream.rule.on === 31 ? 'last' : String(stream.rule.on);
    return t('income.redesign.everyMonthOn', { day });
  }
  return formatStreamSchedule(stream.rule);
}

/** Figma Mobile: Phone / Income (4:1961) + empty / add. */
export function RedesignIncomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useGlobalSearchParams<{ stream?: string; table?: string }>();
  const { snapshot, repo } = useWorkspace();
  const [month] = useState(() => monthOf(today()));
  const addOpen = params.stream === 'new';
  const tableMode = params.table === '1';

  const summary = useMemo(() => (snapshot ? incomeForMonth(snapshot, month) : null), [snapshot, month]);
  const chartPoints = useMemo(() => {
    const all = snapshot ? twelveMonthIncomeSeries(snapshot, month) : [];
    return all.slice(-6);
  }, [snapshot, month]);
  const average =
    chartPoints.length === 0
      ? 0n
      : chartPoints.reduce((s, p) => s + p.received, 0n) / BigInt(chartPoints.length);
  const stillExpected =
    summary && summary.expected > summary.received ? summary.expected - summary.received : 0n;
  const hasStreams = (snapshot?.incomeStreams.length ?? 0) > 0;

  const editStream = useMemo(() => {
    if (!snapshot || !params.stream || params.stream === 'new') return null;
    return snapshot.incomeStreams.find((s) => s.id === params.stream) ?? null;
  }, [snapshot, params.stream]);

  return (
    <SafeAreaView testID="redesign-income" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <RedesignTopBar
        title={t('income.title')}
        onBack={() => router.push('/more')}
        trailing={
          <Pressable
            testID="income-redesign-add"
            accessibilityRole="button"
            accessibilityLabel={t('income.redesign.addIncome')}
            onPress={() => router.setParams({ stream: 'new' })}
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
        {!hasStreams ? (
          <Card testID="income-redesign-empty">
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
                <RedesignIcon name="trending-up" size={28} color={theme.text} />
              </View>
              <RedesignText variant="headline" accessibilityRole="header">
                {t('income.redesign.emptyTitle')}
              </RedesignText>
              <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                {t('income.redesign.emptyBody')}
              </RedesignText>
              <RedesignButton
                testID="income-redesign-empty-add"
                label={t('income.redesign.addIncome')}
                onPress={() => router.setParams({ stream: 'new' })}
              />
            </View>
          </Card>
        ) : null}

        {hasStreams && summary ? (
          <>
            <Card testID="income-redesign-summary">
              <View style={{ padding: sp.lg, gap: sp.sm }}>
                <RedesignText variant="label" tone="textSecondary">
                  {t('income.redesign.receivedIn', { month: monthLongName(month) })}
                </RedesignText>
                <RedesignAmount
                  testID="income-redesign-received"
                  text={formatNaira(summary.received)}
                  sign="+"
                  sizeVariant="display"
                />
                <RedesignText tone="textSecondary">
                  {t('income.redesign.stillExpected', { amount: formatNaira(stillExpected) })}
                </RedesignText>
                <RedesignProgress
                  testID="income-redesign-progress"
                  value={Number(summary.received)}
                  max={Number(summary.expected > 0n ? summary.expected : 1n)}
                />
              </View>
            </Card>

            <Card testID="income-redesign-history">
              <View style={{ padding: sp.lg, gap: sp.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <RedesignText variant="label">{t('income.redesign.last6')}</RedesignText>
                  <RedesignText variant="helper" tone="textSecondary">
                    {t('income.redesign.average', { amount: formatNaira(average) })}
                  </RedesignText>
                </View>
                {tableMode ? (
                  <SixMonthTable points={chartPoints} />
                ) : (
                  <SixMonthChart points={chartPoints} currentMonth={month} />
                )}
                <Pressable
                  testID="income-redesign-view-table"
                  accessibilityRole="button"
                  onPress={() => router.setParams({ table: tableMode ? undefined : '1' })}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <RedesignText variant="label" tone="primary" style={{ textDecorationLine: 'underline' }}>
                    {tableMode ? t('income.redesign.viewAsChart') : t('income.redesign.viewAsTable')}
                  </RedesignText>
                </Pressable>
              </View>
            </Card>

            <View>
              <RedesignText variant="label" tone="textSecondary" style={{ marginBottom: sp.xs }}>
                {t('income.redesign.sources')}
              </RedesignText>
              <Card testID="income-redesign-sources">
                {summary.rows.map((row) => (
                  <RedesignListRow
                    key={row.stream.id}
                    testID={`income-row-${row.stream.id}`}
                    title={row.stream.name}
                    subtitle={sourceSubtitle(row, month)}
                    trailing={`+${formatNaira(row.expected)}`}
                    showChevron
                    onPress={() => router.setParams({ stream: row.stream.id })}
                  />
                ))}
              </Card>
            </View>
          </>
        ) : null}
      </ScrollView>

      {(addOpen || editStream) && snapshot ? (
        <AddIncomeSheet
          snapshot={snapshot}
          existing={editStream}
          onClose={() => router.setParams({ stream: undefined })}
          onSave={async (data) => {
            if (editStream) {
              await repo.updateIncomeStream({ ...data, id: editStream.id });
              toast.show(t('income.streamSaved'));
            } else {
              await repo.addIncomeStream(data);
              toast.show(t('income.redesign.incomeSaved'));
            }
            router.setParams({ stream: undefined });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function SixMonthChart({ points, currentMonth }: { points: TwelveMonthPoint[]; currentMonth: string }) {
  const max = points.reduce((m, p) => (p.received > m ? p.received : m), 0n);
  const maxN = Number(max > 0n ? max : 1n);
  return (
    <View testID="income-redesign-chart" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: sp.xs, height: 120 }}>
      {points.map((p) => {
        const h = Math.max(8, Math.round((Number(p.received) / maxN) * 100));
        const active = p.month === currentMonth;
        return (
          <View key={p.month} style={{ flex: 1, alignItems: 'center', gap: sp.xs }}>
            <View
              style={{
                width: '70%',
                height: h,
                borderTopLeftRadius: shape['radius-sm'],
                borderTopRightRadius: shape['radius-sm'],
                backgroundColor: active ? theme.primary : theme.primarySoft,
              }}
            />
            <RedesignText variant="caption" tone="textSecondary">
              {p.label}
            </RedesignText>
          </View>
        );
      })}
    </View>
  );
}

function SixMonthTable({ points }: { points: TwelveMonthPoint[] }) {
  return (
    <View testID="income-redesign-table" style={{ gap: sp.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <RedesignText variant="caption" tone="textSecondary">
          {t('income.redesign.tableMonth')}
        </RedesignText>
        <RedesignText variant="caption" tone="textSecondary">
          {t('income.redesign.tableReceived')}
        </RedesignText>
      </View>
      {[...points].reverse().map((p) => (
        <View key={p.month} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <RedesignText>{p.label}</RedesignText>
          <RedesignText style={{ fontVariant: ['tabular-nums'] }}>{formatNaira(p.received)}</RedesignText>
        </View>
      ))}
    </View>
  );
}

function AddIncomeSheet({
  snapshot,
  existing,
  onClose,
  onSave,
}: {
  snapshot: Snapshot;
  existing?: IncomeStream | null;
  onClose: () => void;
  onSave: (data: Omit<IncomeStream, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? toInputText(BigInt(existing.expectedMinor)) : '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? snapshot.accounts[0]?.id ?? '');
  const [onDay, setOnDay] = useState(
    String(existing?.rule.on && existing.rule.on !== 0 ? existing.rule.on : Number(today().slice(8, 10))),
  );
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountName = snapshot.accounts.find((a) => a.id === accountId)?.name ?? t('income.redesign.chooseOption');
  const nextPreview = (() => {
    const day = Math.min(Math.max(1, Number(onDay) || 1), 28);
    const [y, m] = today().split('-').map(Number) as [number, number];
    let iso = `${today().slice(0, 7)}-${String(day).padStart(2, '0')}`;
    if (iso < today()) {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      iso = `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return shortDayMonth(iso);
  })();

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t('income.redesign.sourcePlaceholder'));
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError(t('income.redesign.amountHint'));
      return;
    }
    if (!accountId) {
      setError(t('income.redesign.chooseOption'));
      return;
    }
    const categoryId =
      existing?.categoryId ?? snapshot.categories.find((c) => c.kind === 'income')?.id ?? '';
    if (!categoryId) {
      setError(t('income.redesign.chooseOption'));
      return;
    }
    setSaving(true);
    try {
      const day = Math.min(Math.max(1, Number(onDay) || 1), 31);
      await onSave({
        name: name.trim(),
        kind: existing?.kind ?? 'regular',
        expectedMinor: parsed.minor.toString(),
        accountId,
        categoryId,
        rule: { every: 'month', on: day },
        countInBudget: existing?.countInBudget ?? true,
        source: existing?.source,
        taxClass: existing?.taxClass,
        amountKind: existing?.amountKind,
        rangeMinMinor: existing?.rangeMinMinor,
        rangeMaxMinor: existing?.rangeMaxMinor,
        recordMode: existing?.recordMode,
        grossMinor: existing?.grossMinor,
        deductions: existing?.deductions,
        routing: existing?.routing,
        reminder: existing?.reminder,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RedesignSheet
      testID="income-redesign-add-sheet"
      visible
      title={t('income.redesign.addIncome')}
      onClose={onClose}
      dirty={!!name || !!amountText}
      footer={
        <RedesignButton
          testID="income-redesign-save"
          label={t('income.redesign.addIncome')}
          fullWidth
          disabled={saving}
          onPress={() => void save()}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignField
          testID="income-redesign-name"
          label={t('income.redesign.source')}
          value={name}
          onChangeText={setName}
          placeholder={t('income.redesign.sourcePlaceholder')}
        />
        <RedesignField
          testID="income-redesign-amount"
          label={t('plan.amount')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignText variant="helper" tone="textSecondary">
          {t('income.redesign.amountHint')}
        </RedesignText>

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('income.redesign.repeats')}</RedesignText>
          <View
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              justifyContent: 'center',
            }}
          >
            <RedesignText>{t('income.redesign.repeatsMonthly')}</RedesignText>
          </View>
        </View>

        <RedesignField
          testID="income-redesign-day"
          label={t('income.redesign.nextExpected')}
          value={onDay}
          onChangeText={setOnDay}
          keyboardType="number-pad"
          placeholder={t('income.redesign.pickDate')}
        />
        <RedesignText variant="helper" tone="textSecondary">
          {nextPreview}
        </RedesignText>

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('income.redesign.into')}</RedesignText>
          <Pressable
            testID="income-redesign-account"
            accessibilityRole="button"
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
            ? snapshot.accounts.map((a) => (
                <Pressable
                  key={a.id}
                  testID={`income-redesign-account-${a.id}`}
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

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}
