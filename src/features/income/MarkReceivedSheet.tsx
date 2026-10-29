import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Amount, AmountInput, Button, Checkbox, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { IncomeStream } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { useTheme } from '@/design/ThemeProvider';
import { today } from '@/features/transactions/helpers';

import {
  incomeMatchCandidates,
  routingConfirmRows,
  routingPayload,
  type MarkReceivedPayload,
  type RoutingConfirmRow,
} from './markReceived';

const sp = tokens.spacing;

type Props = {
  stream: IncomeStream;
  snapshot: Snapshot;
  month: string;
  expected: bigint;
  received: bigint;
  onClose: () => void;
  onConfirm: (payload: MarkReceivedPayload) => Promise<void>;
};

export function MarkReceivedSheet({ stream, snapshot, month, expected, received, onClose, onConfirm }: Props) {
  const theme = useTheme();
  const remaining = expected > received ? expected - received : 0n;
  const candidates = useMemo(() => incomeMatchCandidates(stream, snapshot, month, remaining), [stream, snapshot, month, remaining]);
  const [phase, setPhase] = useState<'pick' | 'routing'>('pick');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [pendingAmount, setPendingAmount] = useState<bigint | null>(null);
  const [pendingDate, setPendingDate] = useState<string>(today());
  const [routingRows, setRoutingRows] = useState<RoutingConfirmRow[]>([]);
  const [routingOn, setRoutingOn] = useState<Record<string, boolean>>({});

  const openRouting = (amount: bigint, date: string, eventId: string | null) => {
    const rows = routingConfirmRows(stream, snapshot, amount);
    if (rows.length === 0) {
      void finish(eventId, amount, date, {});
      return;
    }
    setPendingAmount(amount);
    setPendingDate(date);
    setSelectedEventId(eventId);
    setRoutingRows(rows);
    const toggles: Record<string, boolean> = {};
    for (const r of rows) toggles[r.key] = true;
    setRoutingOn(toggles);
    setPhase('routing');
  };

  const finish = async (eventId: string | null, amount: bigint, date: string, toggles: Record<string, boolean>) => {
    const rows = routingRows.length ? routingRows : routingConfirmRows(stream, snapshot, amount);
    const routing = routingPayload(rows, toggles);
    if (eventId) {
      await onConfirm({ kind: 'match', eventId, amount, date, routing });
    } else {
      await onConfirm({ kind: 'create', amount, date, routing });
    }
  };

  const pickDisabled = !createNew && !selectedEventId;
  const createDisabled = createNew && (amountMinor === null || amountMinor <= 0n);

  return (
    <Sheet
      visible
      title={t('income.markReceivedTitle')}
      onClose={onClose}
      testID="income-record-sheet"
      footer={
        phase === 'pick' ? (
          <Button
            testID="income-record-next"
            label={t('common.continue')}
            disabled={pickDisabled || createDisabled}
            onPress={() => {
              if (createNew && amountMinor) openRouting(amountMinor, today(), null);
              else if (selectedEventId) {
                const c = candidates.find((x) => x.eventId === selectedEventId);
                if (c) openRouting(c.amount, c.date, c.eventId);
              }
            }}
          />
        ) : (
          <Button
            testID="income-record-save"
            label={t('income.confirmRouting')}
            onPress={() => void finish(selectedEventId, pendingAmount!, pendingDate, routingOn)}
          />
        )
      }
    >
      <Text tone="textSecondary">{stream.name}</Text>
      <Text variant="caption" tone="textSecondary">
        {t('income.matchProgress')}{' '}
        <Amount minor={received} variant="caption" /> {t('goals.of')} <Amount minor={expected} variant="caption" />
      </Text>

      {phase === 'pick' ? (
        <View style={{ gap: sp['spacing-md'] }}>
          <Text variant="heading-sm">{t('income.matchPickTitle')}</Text>
          {candidates.length === 0 ? (
            <Text tone="textSecondary">{t('income.matchEmpty')}</Text>
          ) : (
            candidates.map((c) => (
              <Pressable
                key={c.eventId}
                testID={`income-match-${c.eventId}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedEventId === c.eventId && !createNew }}
                onPress={() => {
                  setCreateNew(false);
                  setSelectedEventId(c.eventId);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: selectedEventId === c.eventId && !createNew ? theme.primaryFill : theme.border,
                  borderRadius: tokens.radius['rounded-sm'],
                  padding: sp['spacing-sm'],
                  gap: sp['spacing-xs'],
                }}
              >
                <Text>
                  {c.title} · {c.date}
                </Text>
                <Amount minor={c.amount} variant="caption" />
                <Text variant="caption" tone="textSecondary">
                  {t(`plan.confidence.${c.confidence}`)}
                  {c.amountNote ? ` · ${c.amountNote}` : ''}
                </Text>
              </Pressable>
            ))
          )}

          <Pressable
            testID="income-match-create"
            accessibilityRole="radio"
            accessibilityState={{ selected: createNew }}
            onPress={() => {
              setCreateNew(true);
              setSelectedEventId(null);
            }}
            style={{
              borderWidth: 1,
              borderColor: createNew ? theme.primaryFill : theme.border,
              borderRadius: tokens.radius['rounded-sm'],
              padding: sp['spacing-sm'],
              gap: sp['spacing-xs'],
            }}
          >
            <Text variant="heading-sm">{t('income.matchCreateNew')}</Text>
            <Text variant="caption" tone="textSecondary">
              {t('income.matchCreateHint')}
            </Text>
            {createNew ? (
              <AmountInput
                testID="income-record-amount"
                label={t('income.receivedAmount')}
                value={amountText}
                onChange={(text, minor) => {
                  setAmountText(text);
                  setAmountMinor(minor);
                }}
              />
            ) : null}
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('income.routingConfirmTitle')}</Text>
          <Text variant="caption" tone="textSecondary">
            {t('income.routingConfirmHint')}
          </Text>
          {routingRows.map((row) => (
            <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
              <View style={{ flex: 1 }}>
                <Text>{row.label}</Text>
                {!row.restToBudget ? <Amount minor={row.amount} variant="caption" /> : null}
              </View>
              {row.goalId || row.categoryId ? (
                <Checkbox
                  testID={`income-routing-${row.key}`}
                  label={t('income.routingApply')}
                  checked={routingOn[row.key] ?? true}
                  onChange={(v) => setRoutingOn((m) => ({ ...m, [row.key]: v }))}
                />
              ) : (
                <Text variant="caption" tone="textSecondary">
                  {row.restToBudget ? <Amount minor={row.amount} variant="caption" /> : null}
                </Text>
              )}
            </View>
          ))}
          {stream.recordMode === 'gross' && stream.grossMinor ? (
            <Text variant="caption" tone="textSecondary">
              {t('income.grossSplitNote')}
            </Text>
          ) : null}
          <Button kind="link" size="sm" label={t('common.back')} onPress={() => setPhase('pick')} />
        </View>
      )}
    </Sheet>
  );
}
