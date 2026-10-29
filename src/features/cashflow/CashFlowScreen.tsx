import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Amount, Button, Card, DatePicker, EmptyState, Icon, Placeholder, Select, Switch, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { percentText } from '@/features/investments/InvestmentsScreen';
import { drillHref, rangeCaption } from '@/features/reports/helpers';
import { rangeFor } from '@/features/reports/runner';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { changeBasisPoints } from '@/ledger/reports';
import { formatNaira, PRIVACY_MASK } from '@/money';

import { cashFlowPage, type FlowGroup } from './helpers';
import { Sankey, sinksOf, sourcesOf } from './Sankey';

const sp = tokens.spacing;
type Range = 'this_month' | 'last_3_months' | 'this_year' | 'custom';
const RANGES: Range[] = ['this_month', 'last_3_months', 'this_year', 'custom'];

/** "26%" from basis points, without a sign. */
const share = (bp: bigint | null) => (bp === null ? '' : percentText(bp).replace('+', ''));

/** Cash flow (DESIGN.md page 22): where money came from and where it went, as a picture. */
export function CashFlowScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const theme = useTheme();
  const { privacy } = useDesign();
  const phone = useSizeClass() === 'phone';
  const onDate = today();
  const [range, setRange] = useState<Range>('this_month');
  const [custom, setCustom] = useState(() => rangeFor('this_month', onDate, null));
  const [accountId, setAccountId] = useState('');
  const [transfers, setTransfers] = useState(false);
  const [simple, setSimple] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : formatNaira(v));

  const dates = useMemo(() => (range === 'custom' ? custom : rangeFor(range, onDate, null)), [range, custom, onDate]);
  const data = useMemo(
    () => (snapshot ? cashFlowPage(snapshot, { ...dates, accountIds: accountId ? [accountId] : undefined, includeTransfers: transfers }) : null),
    [snapshot, dates, accountId, transfers],
  );

  const header = (
    <View style={{ flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
      <View style={{ minWidth: 180, flexGrow: 1 }}>
        <Select testID="cashflow-range" label={t('reports.range')} value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: t(`cashFlow.range.${r}` as TextKey) }))} />
      </View>
      {range === 'custom' ? (
        <>
          <View style={{ minWidth: 160, flexGrow: 1 }}>
            <DatePicker testID="cashflow-from" label={t('cashFlow.from')} value={custom.from} onChange={(from) => setCustom((x) => ({ ...x, from }))} />
          </View>
          <View style={{ minWidth: 160, flexGrow: 1 }}>
            <DatePicker testID="cashflow-to" label={t('cashFlow.to')} value={custom.to} onChange={(to) => setCustom((x) => ({ ...x, to }))} />
          </View>
        </>
      ) : null}
      <View style={{ minWidth: 180, flexGrow: 1 }}>
        <Select
          testID="cashflow-account"
          label={t('reports.accounts')}
          value={accountId}
          onChange={setAccountId}
          options={[{ value: '', label: t('reports.anyAccount') }, ...(snapshot?.accounts ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))]}
        />
      </View>
      <Switch testID="cashflow-transfers" label={t('cashFlow.includeTransfers')} value={transfers} onChange={setTransfers} />
      {phone ? <Switch testID="cashflow-simple" label={t('cashFlow.simpleView')} value={simple} onChange={setSimple} /> : null}
    </View>
  );

  if (!snapshot || !data) {
    return (
      <AppFrame title={t('cashFlow.title')}>
        {header}
        <Placeholder height={480} />
      </AppFrame>
    );
  }

  const sources = sourcesOf(data.bands);
  const sinks = sinksOf(data.groups);
  const band = selected ? (data.bands.find((b) => b.key === selected) ?? null) : null;
  const group = selected ? (data.groups.find((g) => g.key === selected) ?? null) : null;
  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const see = (categoryId?: string) => router.push(drillHref({ ...dates, ...(categoryId ? { categoryId } : {}), ...(accountId ? { accountId } : {}) }));
  const sinkTotal = sinks.reduce((s, n) => s + n.amount, 0n);

  return (
    <AppFrame title={t('cashFlow.title')}>
      {header}
      {data.bands.length === 0 ? (
        <EmptyState testID="cashflow-empty" title={t('cashFlow.emptyTitle')} body={t('cashFlow.emptyBody')} actionLabel={t('cashFlow.addTransaction')} onAction={() => router.push('/transactions')} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
          <Card style={{ gap: sp['spacing-sm'] }}>
            <Text variant="caption" tone="textSecondary">
              {rangeCaption(data.from, data.to)}
            </Text>
            {phone && simple ? (
              <View testID="cashflow-simple-bars" style={{ gap: sp['spacing-sm'] }}>
                <Text variant="heading-sm">{t('cashFlow.whereItWent')}</Text>
                {sinks.map((n) => (
                  <Pressable key={n.key} accessibilityRole="button" accessibilityLabel={`${n.label}, ${show(n.amount)}`} onPress={() => setSelected(n.key)} style={{ gap: sp['spacing-xs'] }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text>{n.label}</Text>
                      <Text style={{ fontVariant: ['tabular-nums'] }}>{show(n.amount)}</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border }}>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: n.colour, width: `${sinkTotal === 0n ? 0 : Number((n.amount * 1000n) / sinkTotal) / 10}%` }} />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Sankey testID="cashflow-sankey" title={t('cashFlow.chartLabel', { in: show(data.tiles.in), out: show(data.tiles.out) })} sources={sources} sinks={sinks} vertical={phone} selected={selected} onSelect={setSelected} />
            )}
          </Card>

          {band || group ? (
            <Card testID="cashflow-selected" style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{band?.label ?? group?.label}</Text>
              <Text testID="cashflow-selected-amount" style={{ fontVariant: ['tabular-nums'] }}>
                {t('cashFlow.bandDetail', { amount: show(band?.amount ?? group!.amount), share: share(band?.shareBasisPoints ?? group!.shareBasisPoints) || t('cashFlow.noIncome') })}
              </Text>
              <Button testID="cashflow-see" kind="link" label={t('cashFlow.seeTransactions')} onPress={() => see(band?.categoryId ?? undefined)} />
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
            <Tile label={t('cashFlow.in')} testID="cashflow-in">
              <Amount minor={data.tiles.in} variant="heading-md" />
            </Tile>
            <Tile label={t('cashFlow.out')} testID="cashflow-out">
              <Amount minor={data.tiles.out} variant="heading-md" />
            </Tile>
            <Tile label={t('cashFlow.saved')} testID="cashflow-saved">
              <Text variant="heading-md">{share(data.tiles.savedBasisPoints) || t('cashFlow.noIncome')}</Text>
            </Tile>
          </View>

          <Card style={{ gap: sp['spacing-xs'] }} testID="cashflow-table">
            <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
              <Text variant="caption" tone="textSecondary" style={{ flex: 2 }}>
                {t('cashFlow.col.group')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
                {t('cashFlow.col.amount')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
                {t('cashFlow.col.share')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'right' }}>
                {t('cashFlow.col.change')}
              </Text>
            </View>
            {data.groups.map((g) => (
              <GroupRow key={g.key} group={g} open={open.has(g.key)} onToggle={() => toggle(g.key)} show={show} onCategory={(id) => see(id)} />
            ))}
          </Card>
        </ScrollView>
      )}
    </AppFrame>
  );
}

function GroupRow({ group, open, onToggle, show, onCategory }: { group: FlowGroup; open: boolean; onToggle: () => void; show: (v: bigint) => string; onCategory: (id: string) => void }) {
  const theme = useTheme();
  const change = changeBasisPoints(group.amount, group.previous);
  const line = { flexDirection: 'row' as const, gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border };
  const can = group.categories.length > 0;
  return (
    <View>
      <Pressable
        testID={`cashflow-group-${group.key}`}
        accessibilityRole={can ? 'button' : undefined}
        accessibilityState={can ? { expanded: open } : undefined}
        disabled={!can}
        onPress={onToggle}
        style={line}
      >
        <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
          {can ? <Icon icon={open ? ChevronDown : ChevronRight} size={16} /> : null}
          <Text>{group.label}</Text>
        </View>
        <Text style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{show(group.amount)}</Text>
        <Text style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{share(group.shareBasisPoints)}</Text>
        <Text testID={`cashflow-change-${group.key}`} style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
          {change === null ? t('cashFlow.new') : percentText(change)}
        </Text>
      </Pressable>
      {open
        ? group.categories.map((cat) => (
            <Pressable key={cat.categoryId} accessibilityRole="link" onPress={() => onCategory(cat.categoryId)} style={{ ...line, paddingLeft: sp['spacing-lg'] }}>
              <Text style={{ flex: 2 }}>{cat.label}</Text>
              <Text style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{show(cat.amount)}</Text>
              <View style={{ flex: 2 }} />
            </Pressable>
          ))
        : null}
    </View>
  );
}

function Tile({ label, children, testID }: { label: string; children: React.ReactNode; testID: string }) {
  return (
    <Card testID={testID} style={{ flexGrow: 1, minWidth: 160, gap: sp['spacing-xs'] }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      {children}
    </Card>
  );
}
