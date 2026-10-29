import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Amount, Card, Placeholder, Switch, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthIncome, monthSpent, periodTotals } from '@/ledger';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { previousPeriod, RangeBar, type DateRange } from './RangeBar';

const sp = tokens.spacing;

/** TB-14 Cash flow page */
export function CashFlowScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const params = useGlobalSearchParams<{ from?: string; to?: string }>();
  const [range, setRange] = useState<DateRange>({
    from: params.from ?? `${today().slice(0, 7)}-01`,
    to: params.to ?? today(),
  });
  const [includeTransfers, setIncludeTransfers] = useState(false);
  const [compare, setCompare] = useState(false);

  const months = useMemo(() => {
    const out: string[] = [];
    let cur = range.from.slice(0, 7);
    const end = range.to.slice(0, 7);
    while (cur <= end) {
      out.push(cur);
      const [y, m] = cur.split('-').map(Number) as [number, number];
      cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    return out;
  }, [range]);

  const bands = useMemo(() => {
    if (!snapshot) return [];
    const totals = periodTotals(snapshot.events);
    return months.map((month) => {
      const income = monthIncome(snapshot.chart, totals, month);
      const spent = monthSpent(snapshot.chart, totals, month);
      return { month, income, spent, net: income - spent };
    });
  }, [snapshot, months]);

  const prev = compare ? previousPeriod(range) : null;

  return (
    <AppFrame title={t('cashflow.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <RangeBar
          range={range}
          onChange={(r) => {
            setRange(r);
            router.setParams({ from: r.from, to: r.to });
          }}
          compare={compare}
          onCompareChange={setCompare}
        />
        <Switch testID="cashflow-transfers" label={t('cashflow.includeTransfers')} value={includeTransfers} onChange={setIncludeTransfers} />
        {!snapshot ? (
          <Placeholder height={120} />
        ) : (
          bands.map((b) => (
            <Card key={b.month} testID={`cashflow-month-${b.month}`} style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{b.month}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{t('cashflow.income')}</Text>
                <Amount minor={b.income} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{t('cashflow.spent')}</Text>
                <Amount minor={b.spent} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{t('cashflow.net')}</Text>
                <Amount minor={b.net} />
              </View>
            </Card>
          ))
        )}
        {prev ? (
          <Text tone="textSecondary" testID="cashflow-compare-range">
            {t('cashflow.compareRange', { from: prev.from, to: prev.to })}
          </Text>
        ) : null}
        {includeTransfers ? (
          <Text variant="caption" tone="textSecondary">
            {t('cashflow.transfersNote')}
          </Text>
        ) : null}
      </ScrollView>
    </AppFrame>
  );
}
