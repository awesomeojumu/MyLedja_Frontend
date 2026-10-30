import { useGlobalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Amount, Button, Card, EmptyState, Icon, Placeholder, Switch, Text } from '@/design/components';
import { isRedesignEnabled } from '@/design/redesign';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';

import { cashFlowPage, drillHref, percentText, rangeCaption, type FlowGroup } from './helpers';
import { spendingAccounts } from './local';
import { RangeBar, type DateRange } from './RangeBar';
import { RedesignCashFlowScreen } from './RedesignCashFlowScreen';
import { Sankey, sinksOf, sourcesOf } from './Sankey';

const sp = tokens.spacing;

const share = (bp: bigint | null) => (bp === null ? '' : percentText(bp).replace('+', '').replace('−', ''));

function parseAccountIds(raw: string | string[] | undefined): string[] {
  const s = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

/** Cash flow (DESIGN.md page 22 / Figma 5:2532 when redesign on). */
export function CashFlowScreen() {
  if (isRedesignEnabled()) return <RedesignCashFlowScreen />;
  return <LegacyCashFlowScreen />;
}

function LegacyCashFlowScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const theme = useTheme();
  const { privacy } = useDesign();
  const size = useSizeClass();
  const phone = size === 'phone';
  const tablet = size === 'tablet';
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const params = useGlobalSearchParams<{ from?: string; to?: string; accountIds?: string; transfers?: string; simple?: string }>();
  const onDate = today();

  const [range, setRange] = useState<DateRange>(() => {
    if (params.from && params.to) return { from: params.from, to: params.to };
    const [y, m] = onDate.split('-').map(Number) as [number, number];
    return { from: `${onDate.slice(0, 7)}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
  });
  const [accountIds, setAccountIds] = useState<string[]>(() => parseAccountIds(params.accountIds));
  const [transfers, setTransfers] = useState(params.transfers === '1' || params.transfers === 'true');
  const [simple, setSimple] = useState(params.simple === '1' || params.simple === 'true');
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : formatNaira(v));

  // Keep the chosen filters in the web address (TB14-1 / PU-19).
  useEffect(() => {
    router.setParams({
      from: range.from,
      to: range.to,
      accountIds: accountIds.length ? accountIds.join(',') : undefined,
      transfers: transfers ? '1' : undefined,
      simple: simple ? '1' : undefined,
    });
  }, [range, accountIds, transfers, simple, router]);

  const data = useMemo(
    () =>
      snapshot
        ? cashFlowPage(snapshot, {
            ...range,
            accountIds: accountIds.length ? accountIds : undefined,
            includeTransfers: transfers,
          })
        : null,
    [snapshot, range, accountIds, transfers],
  );

  const accounts = snapshot ? spendingAccounts(snapshot).map((a) => ({ id: a.id, name: a.name })) : [];
  // Phone portrait: vertical. Phone landscape or larger: horizontal (D22-16/18/19).
  const vertical = phone && !landscape;
  const short = tablet && !landscape;

  const header = (
    <View style={{ gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
      <RangeBar
        range={range}
        onChange={setRange}
        accountIds={accountIds}
        accounts={accounts}
        onAccountsChange={setAccountIds}
        includeTransfers={transfers}
        onTransfersChange={setTransfers}
      />
      {phone ? <Switch testID="cashflow-simple" label={t('cashFlow.simpleView')} value={simple} onChange={setSimple} /> : null}
    </View>
  );

  if (!snapshot || !data) {
    return (
      <AppFrame title={t('cashFlow.title')}>
        {header}
        <Placeholder height={480} testID="cashflow-loading" />
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
  const see = (categoryId?: string) =>
    router.push(
      drillHref({
        ...range,
        ...(categoryId ? { categoryId } : {}),
        ...(accountIds.length === 1 ? { accountId: accountIds[0] } : { accountIds }),
      }),
    );
  const sinkTotal = sinks.reduce((s, n) => s + n.amount, 0n);

  return (
    <AppFrame title={t('cashFlow.title')}>
      {header}
      {data.bands.length === 0 ? (
        <View testID="cashflow-empty">
          <EmptyState
            title={t('cashFlow.emptyTitle')}
            body={t('cashFlow.emptyBody')}
            actionLabel={t('cashFlow.addTransaction')}
            onAction={() => router.push('/transactions')}
          />
        </View>
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
                  <Pressable
                    key={n.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.label}, ${show(n.amount)}`}
                    onPress={() => setSelected(n.key)}
                    style={{ gap: sp['spacing-xs'] }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text>{n.label}</Text>
                      <Text style={{ fontVariant: ['tabular-nums'] }}>{show(n.amount)}</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border }}>
                      <View
                        style={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: n.colour,
                          width: `${sinkTotal === 0n ? 0 : Number((n.amount * 1000n) / sinkTotal) / 10}%`,
                        }}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Sankey
                testID="cashflow-sankey"
                title={t('cashFlow.chartLabel', { in: show(data.tiles.in), out: show(data.tiles.out) })}
                sources={sources}
                sinks={sinks}
                vertical={vertical}
                short={short}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </Card>

          {band || group ? (
            <Card testID="cashflow-selected" style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{band?.label ?? group?.label}</Text>
              <Text testID="cashflow-selected-amount" style={{ fontVariant: ['tabular-nums'] }}>
                {t('cashFlow.bandDetail', {
                  amount: show(band?.amount ?? group!.amount),
                  share: share(band?.shareBasisPoints ?? group!.shareBasisPoints) || t('cashFlow.noIncome'),
                })}
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

function GroupRow({
  group,
  open,
  onToggle,
  show,
  onCategory,
}: {
  group: FlowGroup;
  open: boolean;
  onToggle: () => void;
  show: (v: bigint) => string;
  onCategory: (id: string) => void;
}) {
  const theme = useTheme();
  const change = changeBp(group.amount, group.previous);
  const line = {
    flexDirection: 'row' as const,
    gap: sp['spacing-sm'],
    paddingVertical: sp['spacing-xs'],
    borderTopWidth: 1,
    borderTopColor: theme.border,
  };
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

function changeBp(now: bigint, before: bigint): bigint | null {
  if (before === 0n) return null;
  return ((now - before) * 10_000n) / (before < 0n ? -before : before);
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
