import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronLeft, ChevronRight, Circle, CircleDashed, CircleDot, MoreHorizontal } from 'lucide-react-native';

import { Amount, Button, Card, EmptyState, Icon, InlineError, Placeholder, Select, Sheet, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { budgetAssignId, type IncomeStream } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthOf, nextMonth, prevMonth } from '@/ledger';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { useTheme } from '@/design/ThemeProvider';

import { AddIncomeStreamSheet } from './AddIncomeStreamSheet';
import {
  eventIncomeAmount,
  formatStreamSchedule,
  groupStreamRows,
  incomeForMonth,
  investmentIncomeForMonth,
  routingSummary,
  streamPaymentDots,
  takeHomeMinor,
  taxTotalsForYear,
  twelveMonthIncomeSeries,
  unmatchedEvents,
  unmatchedIncome,
} from './helpers';
import { IncomeTwelveMonthChart } from './IncomeTwelveMonthChart';
import { MarkReceivedSheet } from './MarkReceivedSheet';
import type { MarkReceivedPayload } from './markReceived';

const sp = tokens.spacing;

export function IncomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useGlobalSearchParams<{ stream?: string }>();
  const { snapshot, repo } = useWorkspace();
  const [month, setMonth] = useState(() => monthOf(today()));
  const year = month.slice(0, 4);
  const streamParam = typeof params.stream === 'string' ? params.stream : undefined;
  const addOpen = streamParam === 'new';
  const editStream = useMemo(() => {
    if (!snapshot || !streamParam || streamParam === 'new') return null;
    return snapshot.incomeStreams.find((s) => s.id === streamParam) ?? null;
  }, [snapshot, streamParam]);
  const [recordStream, setRecordStream] = useState<{ stream: IncomeStream; expected: bigint; received: bigint } | null>(null);
  const [linkEventId, setLinkEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeStream = () => router.setParams({ stream: undefined });

  const summary = useMemo(() => (snapshot ? incomeForMonth(snapshot, month) : null), [snapshot, month]);
  const grouped = useMemo(() => (summary ? groupStreamRows(summary.rows) : []), [summary]);
  const unmatched = snapshot ? unmatchedIncome(snapshot, month) : 0n;
  const unmatchedList = snapshot ? unmatchedEvents(snapshot, month) : [];
  const investmentRows = snapshot ? investmentIncomeForMonth(snapshot, month) : [];
  const taxRows = snapshot ? taxTotalsForYear(snapshot, year) : [];
  const chartPoints = useMemo(() => (snapshot ? twelveMonthIncomeSeries(snapshot, month) : []), [snapshot, month]);
  const streamOptions = snapshot?.incomeStreams.map((s) => ({ value: s.id, label: s.name })) ?? [];

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en', { month: 'long', year: 'numeric' });
  }, [month]);

  return (
    <AppFrame title={t('income.title')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp['spacing-md'], gap: sp['spacing-sm'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
          <Pressable
            testID="income-month-prev"
            accessibilityRole="button"
            accessibilityLabel={t('common.previous')}
            onPress={() => setMonth((m) => prevMonth(m))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon icon={ChevronLeft} size="tile" />
          </Pressable>
          <Text variant="heading-sm">{monthLabel}</Text>
          <Pressable
            testID="income-month-next"
            accessibilityRole="button"
            accessibilityLabel={t('common.next')}
            onPress={() => setMonth((m) => nextMonth(m))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon icon={ChevronRight} size="tile" />
          </Pressable>
        </View>
        <Button testID="income-add" label={t('income.addStream')} onPress={() => router.setParams({ stream: 'new' })} />
      </View>

      {summary ? (
        <View testID="income-summary" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
          <SummaryTile label={t('income.expected')} minor={summary.expected} />
          <SummaryTile label={t('income.received')} minor={summary.received} />
          <SummaryTile label={t('income.stillToCome')} minor={summary.expected > summary.received ? summary.expected - summary.received : 0n} />
          <SummaryTile
            label={t('income.steadinessLabel')}
            text={summary.steadiness !== null ? t('income.steadinessShort', { percent: summary.steadiness }) : t('common.notSet')}
          />
        </View>
      ) : null}

      {error ? <InlineError message={error} /> : null}

      {!summary ? (
        <Placeholder height={120} />
      ) : summary.rows.length === 0 && unmatched === 0n && investmentRows.length === 0 ? (
        <EmptyState title={t('income.emptyTitle')} body={t('income.emptyBody')} actionLabel={t('income.addStream')} onAction={() => router.setParams({ stream: 'new' })} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-md'], paddingBottom: sp['spacing-xl'] }}>
          {grouped.map(({ kind, rows }) => (
            <View key={kind} style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t(`income.kind.${kind}`)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
                {rows.map(({ stream, expected, received }) => (
                  <StreamCard
                    key={stream.id}
                    stream={stream}
                    snapshot={snapshot!}
                    month={month}
                    expected={expected}
                    received={received}
                    onRecord={() => setRecordStream({ stream, expected, received })}
                    onEdit={() => router.setParams({ stream: stream.id })}
                  />
                ))}
              </View>
            </View>
          ))}

          {unmatched > 0n ? (
            <Card testID="income-unmatched" style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('income.unmatchedTitle')}</Text>
              <Text tone="textSecondary">{t('income.unmatchedHint')}</Text>
              <Amount minor={unmatched} />
              {unmatchedList.map((e) => (
                <View key={e.id} style={{ gap: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border, paddingTop: sp['spacing-sm'] }}>
                  <Text>
                    {e.date} · <Amount minor={eventIncomeAmount(snapshot!, e.id)} variant="caption" />
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                    <Button testID={`income-link-${e.id}`} kind="secondary" size="sm" label={t('income.linkToStream')} onPress={() => setLinkEventId(e.id)} />
                    <Button testID={`income-new-stream-${e.id}`} kind="secondary" size="sm" label={t('income.makeNewStream')} onPress={() => router.setParams({ stream: 'new' })} />
                    <Button testID={`income-oneoff-${e.id}`} kind="link" size="sm" label={t('income.markOneOff')} onPress={() => void repo.markIncomeOneOff(e.id)} />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {investmentRows.length > 0 ? (
            <Card testID="income-investment" style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('income.investmentTitle')}</Text>
              <Text tone="textSecondary">{t('income.investmentHint')}</Text>
              {investmentRows.map((row) => (
                <View key={row.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
                  <View style={{ flex: 1 }}>
                    <Text>{row.label}</Text>
                    {row.detail ? (
                      <Text variant="caption" tone="textSecondary">
                        {row.detail}
                      </Text>
                    ) : null}
                  </View>
                  <Amount minor={row.amount} variant="caption" />
                </View>
              ))}
            </Card>
          ) : null}

          {taxRows.length > 0 ? (
            <Card testID="income-tax-table" style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{t('income.taxTitle', { year })}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sp['spacing-xs'] }}>
                <Text variant="caption" tone="textSecondary">
                  {t('income.taxClassCol')}
                </Text>
                <Text variant="caption" tone="textSecondary">
                  {t('income.taxGrossCol')}
                </Text>
              </View>
              {taxRows.map((row) => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border, paddingVertical: sp['spacing-xs'] }}>
                  <Text>{row.label}</Text>
                  <Amount minor={row.gross} variant="caption" />
                </View>
              ))}
            </Card>
          ) : null}

          {chartPoints.length > 0 ? (
            <Card>
              <IncomeTwelveMonthChart points={chartPoints} />
            </Card>
          ) : null}
        </ScrollView>
      )}

      {addOpen && snapshot ? (
        <AddIncomeStreamSheet
          snapshot={snapshot}
          onClose={closeStream}
          onSave={async (data) => {
            await repo.addIncomeStream(data);
            toast.show(t('income.streamAdded'));
            closeStream();
          }}
        />
      ) : null}
      {editStream && snapshot ? (
        <AddIncomeStreamSheet
          snapshot={snapshot}
          existing={editStream}
          onClose={closeStream}
          onSave={async (data) => {
            await repo.updateIncomeStream({ ...data, id: editStream.id });
            toast.show(t('income.streamSaved'));
            closeStream();
          }}
        />
      ) : null}
      {recordStream && snapshot ? (
        <MarkReceivedSheet
          stream={recordStream.stream}
          snapshot={snapshot}
          month={month}
          expected={recordStream.expected}
          received={recordStream.received}
          onClose={() => setRecordStream(null)}
          onConfirm={async (payload: MarkReceivedPayload) => {
            setError(null);
            const { stream } = recordStream;
            const date = payload.date;
            if (payload.kind === 'match') {
              await repo.linkEventToStream(payload.eventId, stream.id);
            } else {
              const r = await repo.recordIncomeReceived(stream.id, {
                accountId: stream.accountId,
                amount: payload.amount,
                date,
              });
              if (!r.ok) {
                setError(ledgerMessage(r.error));
                return;
              }
            }
            for (const row of payload.routing) {
              if (!row.apply) continue;
              if (row.goalId) {
                const alloc = await repo.allocateToGoal(row.goalId, { amount: row.amount, date, fromAccountId: stream.accountId });
                if (!alloc.ok) setError(ledgerMessage(alloc.error));
              } else if (row.categoryId && snapshot) {
                const m = monthOf(date);
                const current = snapshot.assigns.get(budgetAssignId(row.categoryId, m)) ?? 0n;
                await repo.setAssigned(row.categoryId, m, current + row.amount);
              }
            }
            toast.show(t('income.markedReceived'));
            setRecordStream(null);
          }}
        />
      ) : null}
      {linkEventId && snapshot && streamOptions.length > 0 ? (
        <LinkStreamSheet
          streams={streamOptions}
          onClose={() => setLinkEventId(null)}
          onLink={(streamId) => {
            void repo.linkEventToStream(linkEventId, streamId);
            setLinkEventId(null);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function SummaryTile({ label, minor, text }: { label: string; minor?: bigint; text?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 140, gap: sp['spacing-xs'] }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
          {minor !== undefined ? <Amount minor={minor} /> : null}
      {text ? <Text variant="heading-sm">{text}</Text> : null}
    </Card>
  );
}

function StreamCard({
  stream,
  snapshot,
  month,
  expected,
  received,
  onRecord,
  onEdit,
}: {
  stream: IncomeStream;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  month: string;
  expected: bigint;
  received: bigint;
  onRecord: () => void;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const dots = streamPaymentDots(stream, snapshot, month);
  const pct = expected > 0n ? Number((received * 100n) / expected) : 0;
  const route = routingSummary(stream, snapshot);
  const takeHome = takeHomeMinor(stream);
  return (
    <Card testID={`income-stream-${stream.id}`} style={{ flex: 1, minWidth: 280, gap: sp['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading-sm">{stream.name}</Text>
          <Text variant="caption" tone="textSecondary">
            {formatStreamSchedule(stream.rule)}
            {stream.source ? ` · ${stream.source}` : ''}
            {stream.taxClass ? ` · ${stream.taxClass}` : ''}
          </Text>
        </View>
        <Pressable
          testID={`income-edit-${stream.id}`}
          accessibilityRole="button"
          accessibilityLabel={t('income.editStream')}
          onPress={onEdit}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon icon={MoreHorizontal} size="nav" color={theme.textSecondary} />
        </Pressable>
      </View>
      {!stream.countInBudget ? (
        <Text variant="caption" tone="textSecondary">
          {t('income.offBudget')}
        </Text>
      ) : null}
      {stream.recordMode === 'gross' && stream.grossMinor ? (
        <Text variant="caption" tone="textSecondary">
          {t('income.grossLabel')}{' '}
          <Amount minor={BigInt(stream.grossMinor)} variant="caption" /> · {t('income.takeHomeLabel')}{' '}
          <Amount minor={takeHome} variant="caption" />
        </Text>
      ) : null}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: tokens.color.primary }} />
      </View>
      <Text tone="textSecondary">
        <Amount minor={received} variant="caption" /> {t('goals.of')} <Amount minor={expected} variant="caption" />
      </Text>
      {route ? (
        <Text variant="caption" tone="textSecondary">
          → {route}
        </Text>
      ) : null}
      <View accessibilityRole="text" accessibilityLabel={dots.map((d) => t(`income.dot.${d}`)).join(', ')} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {dots.map((d, i) => {
          const color = d === 'missed' ? tokens.color.ruby : theme.textSecondary;
          if (d === 'onTime') return <Icon key={i} icon={Circle} size={10} color={color} fill={color} />;
          if (d === 'partial') return <Icon key={i} icon={CircleDot} size={10} color={color} />;
          if (d === 'late') return <Icon key={i} icon={CircleDashed} size={10} color={color} />;
          if (d === 'missed') return <Icon key={i} icon={Circle} size={10} color={color} />;
          return <Icon key={i} icon={Circle} size={8} color={theme.border} fill={theme.border} />;
        })}
      </View>
      {received < expected ? (
        <Button testID={`income-record-${stream.id}`} kind="secondary" label={t('income.markReceived')} onPress={onRecord} />
      ) : received > expected ? (
        <Text variant="caption" tone="textSecondary">
          {t('income.aboveExpected')} <Amount minor={received - expected} variant="caption" />
        </Text>
      ) : (
        <Text variant="caption" tone="textSecondary">
          {t('income.receivedOnTime')}
        </Text>
      )}
    </Card>
  );
}

function LinkStreamSheet({
  streams,
  onClose,
  onLink,
}: {
  streams: { value: string; label: string }[];
  onClose: () => void;
  onLink: (streamId: string) => void;
}) {
  const [streamId, setStreamId] = useState(streams[0]?.value ?? '');
  return (
    <Sheet visible title={t('income.linkToStream')} onClose={onClose} testID="income-link-sheet" footer={<Button label={t('panel.save')} disabled={!streamId} onPress={() => onLink(streamId)} />}>
      <Select testID="income-link-select" label={t('income.pickStream')} options={streams} value={streamId} onChange={setStreamId} />
    </Sheet>
  );
}
