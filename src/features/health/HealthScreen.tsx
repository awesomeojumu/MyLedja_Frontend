import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Info, Settings2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { healthApi } from '@/api/health';
import {
  AmountInput,
  Button,
  Card,
  Checkbox,
  Footer,
  Icon,
  LineChart,
  Placeholder,
  ProgressRing,
  SegmentedControl,
  Sheet,
  Switch,
  Text,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { usePopupParam } from '@/design/usePopupParam';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import type { HealthSettings } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { monthLabel } from '@/features/budget/helpers';
import { AppFrame } from '@/features/frame/AppFrame';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { stress, type Advice, type Pillar, type PillarKey } from '@/ledger/health';
import { formatNaira, parseAmount, PRIVACY_MASK, roundHalfAwayFromZero } from '@/money';

import { healthPage, shiftMonth, type HealthPage } from './helpers';

const sp = tokens.spacing;
const MONEY_USED = new Set(['income', 'spending', 'cash', 'essential', 'borrowed', 'payments']);
const PAGES: Record<Advice['link'], string> = { budget: '/budget', goals: '/goals', debts: '/debts', plan: '/plan' };

/** "26%" from basis points. */
const pct = (bp: bigint) => `${roundHalfAwayFromZero(bp, 100n)}%`;
/** "3.2" from hundredths of a month. */
const months = (h: bigint) => `${h / 100n}.${(h % 100n) / 10n}`;

/** What a pillar's tile says (DESIGN.md page 23). */
export function pillarValue(p: Pillar): string {
  if (p.value === null && p.score === null) return t('health.notEnough');
  switch (p.key) {
    case 'saving':
      return p.value === null ? t('health.notEnough') : t('health.value.saving', { pct: pct(p.value) });
    case 'runway':
      return p.value === null ? t('health.value.runwayNoSpending') : t('health.value.runway', { months: months(p.value), target: String(p.used.target) });
    case 'debt_load':
      return p.value === null ? t('health.value.debtNoIncome') : t('health.value.debt', { pct: pct(p.value) });
    case 'bills':
      return t('health.value.bills', { pct: pct(p.value ?? 0n) });
    case 'budget':
      return t('health.value.budget', { within: String(p.used.within), planned: String(p.used.planned) });
  }
}

/** One plain sentence on why (P23-01): what's going well and what would lift the score. */
export function reasonText(page: HealthPage): string {
  const parts: string[] = [];
  if (page.reason.strongest) parts.push(t(`health.good.${page.reason.strongest}` as TextKey));
  if (page.reason.weakest && page.band !== 'strong') parts.push(t(`health.next.${page.reason.weakest}` as TextKey));
  return parts.join(' ');
}

export function adviceText(a: Advice, show: (v: bigint) => string): string {
  switch (a.pillar) {
    case 'runway':
      return t('health.advice.runway', { amount: show(a.monthly) });
    case 'bills':
      return t('health.advice.bills', { count: String(a.late) });
    case 'budget':
      return t('health.advice.budget', { count: String(a.overspent) });
    default:
      return t(`health.advice.${a.pillar}` as TextKey);
  }
}

/** Health (DESIGN.md page 23): one honest score, the reasons behind it, and what to do next. */
export function HealthScreen() {
  const { snapshot, repo } = useWorkspace();
  const { user, client } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const toast = useToast();
  const { privacy } = useDesign();
  const size = useSizeClass();
  const phone = size === 'phone';
  const onDate = today();
  const [month, setMonth] = useState(onDate.slice(0, 7));
  const [explain, setExplain] = useState<PillarKey | null>(null);
  const [sharing, setSharing] = useState(false);
  const settingsPopup = usePopupParam({ param: 'healthSettings', openWhen: (v) => v === '1', emptyDraft: {} });
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : formatNaira(v));

  const page = useMemo(() => (snapshot ? healthPage(snapshot, month, onDate) : null), [snapshot, month, onDate]);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
      <Pressable testID="health-prev" accessibilityRole="button" accessibilityLabel={t('health.prevMonth')} onPress={() => setMonth((m) => shiftMonth(m, -1))} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={ChevronLeft} size="nav" />
      </Pressable>
      <Text variant="heading-sm" testID="health-month">
        {monthLabel(month)}
      </Text>
      <Pressable
        testID="health-next"
        accessibilityRole="button"
        accessibilityLabel={t('health.nextMonth')}
        accessibilityState={{ disabled: month >= onDate.slice(0, 7) }}
        disabled={month >= onDate.slice(0, 7)}
        onPress={() => setMonth((m) => shiftMonth(m, 1))}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: month >= onDate.slice(0, 7) ? 0.4 : 1 }}
      >
        <Icon icon={ChevronRight} size="nav" />
      </Pressable>
      <View style={{ flex: 1 }} />
      <Button testID="health-share" kind="secondary" label={t('health.share')} disabled={!page?.ready} onPress={() => setSharing(true)} />
      <Pressable testID="health-settings" accessibilityRole="button" accessibilityLabel={t('health.settings')} onPress={() => settingsPopup.openWith('1')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={Settings2} size="nav" />
      </Pressable>
    </View>
  );

  if (!snapshot || !page) {
    return (
      <AppFrame title={t('health.title')}>
        {header}
        <Placeholder height={200} />
      </AppFrame>
    );
  }

  const prevName = monthLabel(shiftMonth(month, -1));
  const tiles = (
    <ScrollView horizontal={phone} contentContainerStyle={{ gap: sp['spacing-sm'], flexDirection: 'row', flexWrap: phone ? 'nowrap' : 'wrap' }}>
      {page.pillars.map((p) => (
        <Pressable
          key={p.key}
          testID={`health-tile-${p.key}`}
          accessibilityRole="button"
          accessibilityLabel={`${t(`health.pillar.${p.key}` as TextKey)}, ${pillarValue(p)}`}
          onPress={() => setExplain(p.key)}
          style={{ minWidth: phone ? 160 : 150, flexGrow: phone ? 0 : 1, flexBasis: phone ? undefined : 0 }}
        >
          <Card style={{ gap: sp['spacing-xs'], flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="caption" tone="textSecondary">
                {t(`health.pillar.${p.key}` as TextKey)}
              </Text>
              <Icon icon={Info} size={16} color={theme.textSecondary} />
            </View>
            <Text testID={`health-value-${p.key}`}>{pillarValue(p)}</Text>
            {p.score !== null ? (
              <Text variant="caption" tone="textSecondary">
                {p.score >= 80 ? t('health.onTrack') : t('health.room')}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <AppFrame title={t('health.title')}>
      {header}
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <Card style={{ gap: sp['spacing-sm'] }} testID="health-score-card">
          {page.ready && page.score !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
              <ProgressRing value={page.score / 100} label={t('health.scoreLabel', { score: String(page.score) })} size={72} />
              <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
                <Text variant="display-md" testID="health-score">
                  {String(page.score)}
                </Text>
                <Text variant="heading-sm" testID="health-band">
                  {t(`health.band.${page.band}` as TextKey)}
                </Text>
                {page.change !== null ? (
                  <Text variant="caption" tone="textSecondary" testID="health-change">
                    {page.change > 0
                      ? t('health.changeUp', { n: String(page.change), month: prevName })
                      : page.change < 0
                        ? t('health.changeDown', { n: String(-page.change), month: prevName })
                        : t('health.changeSame', { month: prevName })}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{ gap: sp['spacing-xs'] }} testID="health-not-ready">
              <Text variant="heading-sm">{t('health.notReadyTitle')}</Text>
              {page.missing.map((m) => (
                <Text key={m} tone="textSecondary">
                  {t(`health.missing.${m}` as TextKey)}
                </Text>
              ))}
            </View>
          )}
          {page.ready ? <Text testID="health-reason">{reasonText(page)}</Text> : null}
          {page.basedOnDataUpTo ? (
            <Text variant="caption" tone="textSecondary" testID="health-stale">
              {t('health.basedOn', { date: formatDay(page.basedOnDataUpTo) })}
            </Text>
          ) : null}
        </Card>

        {tiles}

        {page.advice.length ? (
          <Card style={{ gap: sp['spacing-sm'] }} testID="health-advice">
            <Text variant="heading-sm">{t('health.whatNext')}</Text>
            {page.advice.map((a, i) => (
              <View key={a.pillar} style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], borderTopWidth: i ? 1 : 0, borderTopColor: theme.border, paddingTop: i ? sp['spacing-xs'] : 0 }}>
                <Text style={{ flex: 1 }}>{`${i + 1}. ${adviceText(a, show)}`}</Text>
                <Button testID={`health-advice-${a.pillar}`} kind="link" label={t(`health.link.${a.link}` as TextKey)} onPress={() => router.push(PAGES[a.link])} />
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ flexDirection: phone ? 'column' : 'row', gap: sp['spacing-lg'] }}>
          <View style={{ flex: 1 }}>
            <StressTest page={page} show={show} />
          </View>
          <Card style={{ flex: 1, gap: sp['spacing-sm'] }}>
            <LineChart
              testID="health-history"
              title={t('health.history')}
              columns={[t('health.col.month'), t('health.col.score')]}
              rows={page.history.filter((h) => h.score !== null).map((h) => ({ label: monthLabel(h.month), value: BigInt(h.score!) }))}
              format={(v) => String(v)}
            />
            <Text variant="heading-sm">{t('health.compareTitle')}</Text>
            {page.pillars.map((p) => {
              const before = page.previous.pillars.find((x) => x.key === p.key);
              return (
                <View key={p.key} style={{ flexDirection: 'row', gap: sp['spacing-sm'] }} testID={`health-compare-${p.key}`}>
                  <Text style={{ flex: 2 }}>{t(`health.pillar.${p.key}` as TextKey)}</Text>
                  <Text style={{ flex: 1, textAlign: 'right' }}>{before?.score ?? t('health.dash')}</Text>
                  <Text style={{ flex: 1, textAlign: 'right' }}>{p.score ?? t('health.dash')}</Text>
                </View>
              );
            })}
          </Card>
        </View>
      </ScrollView>

      {explain ? <ExplainSheet pillar={page.pillars.find((p) => p.key === explain)!} show={show} onClose={() => setExplain(null)} onOpen={(href) => router.push(href)} /> : null}
      {sharing ? <ShareSheet page={page} onClose={() => setSharing(false)} /> : null}
      {settingsPopup.open ? (
        <HealthSettingsSheet
          initial={page.settings}
          accounts={snapshot.accounts.filter((a) => !a.archived && ['bank', 'cash', 'wallet', 'savings', 'investment'].includes(a.type))}
          categories={snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden)}
          onClose={settingsPopup.close}
          onSave={async (healthSettings) => {
            await repo.saveHealthSettings(healthSettings);
            if (user?.workspaceId) {
              try {
                await healthApi(client).setSettings(user.workspaceId, {
                  cashAccountIds: healthSettings.cashAccountIds ?? null,
                  targetMonths: healthSettings.targetMonths,
                  countInvestments: healthSettings.countInvestments,
                });
              } catch {
                // Offline or unsigned: local settings still apply until the next sync.
              }
            }
            toast.show(t('health.settingsSaved'));
            settingsPopup.close();
          }}
          onToggleEssential={async (categoryId, essential) => {
            const cat = snapshot.categories.find((c) => c.id === categoryId);
            if (cat) await repo.updateCategory({ ...cat, essential });
          }}
        />
      ) : null}
    </AppFrame>
  );
}

const PILLAR_LINK: Record<PillarKey, string> = { saving: '/budget', runway: '/goals', debt_load: '/debts', bills: '/plan', budget: '/budget' };

/** The formula in words, the numbers it used, and a link to what drives it (P23-02). */
function ExplainSheet({ pillar, show, onClose, onOpen }: { pillar: Pillar; show: (v: bigint) => string; onClose: () => void; onOpen: (href: string) => void }) {
  return (
    <Sheet visible testID="health-explain" title={t(`health.pillar.${pillar.key}` as TextKey)} onClose={onClose} footer={<Button kind="secondary" label={t(`health.open.${pillar.key}` as TextKey)} onPress={() => onOpen(PILLAR_LINK[pillar.key])} />}>
      <Text>{t(`health.formula.${pillar.key}` as TextKey)}</Text>
      <View style={{ gap: sp['spacing-xs'], marginTop: sp['spacing-sm'] }}>
        {Object.entries(pillar.used).map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }} testID={`health-used-${k}`}>
            <Text tone="textSecondary">{t(`health.used.${k}` as TextKey)}</Text>
            <Text style={{ fontVariant: ['tabular-nums'] }}>{MONEY_USED.has(k) ? show(v) : String(v)}</Text>
          </View>
        ))}
      </View>
      <Text variant="caption" tone="textSecondary" style={{ marginTop: sp['spacing-sm'] }}>
        {pillar.score === null ? t('health.notEnough') : t('health.pillarScore', { score: String(pillar.score) })}
      </Text>
    </Sheet>
  );
}

const STEPS = Array.from({ length: 11 }, (_, i) => i * 10);

/** If income dropped or a surprise cost came: updates as it moves, and nothing is saved (P23-06). */
function StressTest({ page, show }: { page: HealthPage; show: (v: bigint) => string }) {
  const theme = useTheme();
  const [drop, setDrop] = useState(30);
  const [costText, setCostText] = useState('');
  const parsed = parseAmount(costText || '0');
  const cost = parsed.ok ? parsed.minor : 0n;
  const result = stress(page.input, BigInt(drop * 100), cost);
  const runway = (v: bigint | null) => (v === null ? t('health.dash') : months(v));
  const score = (v: number | null) => (v === null ? t('health.dash') : String(v));
  return (
    <Card style={{ gap: sp['spacing-sm'] }} testID="health-stress">
      <Text variant="heading-sm">{t('health.stressTitle')}</Text>
      <Text tone="textSecondary">{t('health.stressDrop', { pct: String(drop) })}</Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('health.stressDropLabel')}
        accessibilityValue={{ min: 0, max: 100, now: drop, text: `${drop}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => setDrop((d) => Math.max(0, Math.min(100, d + (e.nativeEvent.actionName === 'increment' ? 10 : -10))))}
        testID="health-stress-slider"
        style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}
      >
        {STEPS.map((s) => (
          <Pressable key={s} testID={`health-stress-${s}`} onPress={() => setDrop(s)} style={{ flex: 1, height: 44, justifyContent: 'center' }}>
            <View style={{ height: 4, backgroundColor: s <= drop ? theme.primaryFill : theme.border }} />
            {s === drop ? <View style={{ position: 'absolute', alignSelf: 'center', width: 16, height: 16, borderRadius: 8, backgroundColor: theme.primaryFill }} /> : null}
          </Pressable>
        ))}
      </View>
      <AmountInput testID="health-stress-cost" label={t('health.stressCost')} value={costText} onChange={(text) => setCostText(text)} allowZero />
      <Text testID="health-stress-runway">{t('health.stressRunway', { before: runway(result.runway.before), after: runway(result.runway.after) })}</Text>
      <Text testID="health-stress-score">{t('health.stressScore', { before: score(result.score.before), after: score(result.score.after) })}</Text>
      {cost > 0n ? (
        <Text variant="caption" tone="textSecondary">
          {t('health.stressNote', { amount: show(cost) })}
        </Text>
      ) : null}
    </Card>
  );
}

/** Share: a clean summary, amounts hidden by default (P23-08). */
export function shareText(page: HealthPage, hideAmounts: boolean): string {
  const lines = [
    t('health.shareHeading', { month: monthLabel(page.month) }),
    t('health.shareScore', { score: String(page.score ?? ''), band: page.band ? t(`health.band.${page.band}` as TextKey) : '' }),
    ...page.pillars.map((p) => `${t(`health.pillar.${p.key}` as TextKey)}: ${pillarValue(p)}`),
  ];
  if (!hideAmounts) lines.push(t('health.shareCash', { amount: formatNaira(page.input.liquidCash) }));
  return lines.join('\n');
}

function ShareSheet({ page, onClose }: { page: HealthPage; onClose: () => void }) {
  const toast = useToast();
  const [hide, setHide] = useState(true);
  const text = shareText(page, hide);
  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        await globalThis.navigator?.clipboard?.writeText(text);
        toast.show(t('health.copied'));
      } else {
        await Share.share({ message: text, title: t('health.title') });
      }
    } catch {
      if (Platform.OS === 'web') await globalThis.navigator?.clipboard?.writeText(text);
    }
    onClose();
  };
  return (
    <Sheet
      visible
      testID="health-share-sheet"
      title={t('health.share')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="health-share-send" label={Platform.OS === 'web' ? t('health.downloadImage') : t('health.share')} onPress={() => void share()} />
        </Footer>
      }
    >
      <Card cream testID="health-share-preview">
        <Text>{text}</Text>
      </Card>
      <Switch testID="health-share-hide" label={t('health.hideAmounts')} value={hide} onChange={setHide} />
      {Platform.OS === 'web' ? (
        <Button
          kind="secondary"
          label={t('health.copyText')}
          onPress={() => {
            void globalThis.navigator?.clipboard?.writeText(text);
            toast.show(t('health.copied'));
          }}
        />
      ) : null}
    </Sheet>
  );
}

function HealthSettingsSheet({
  initial,
  accounts,
  categories,
  onSave,
  onClose,
  onToggleEssential,
}: {
  initial: HealthSettings;
  accounts: { id: string; name: string; type: string }[];
  categories: { id: string; name: string; essential?: boolean }[];
  onSave: (s: HealthSettings) => Promise<void>;
  onClose: () => void;
  onToggleEssential: (id: string, essential: boolean) => Promise<void>;
}) {
  const [chosen, setChosen] = useState<string[] | null | undefined>(initial.cashAccountIds);
  const [target, setTarget] = useState<'3' | '6' | '12'>(String(initial.targetMonths) as '3' | '6' | '12');
  const [investments, setInvestments] = useState(initial.countInvestments);
  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const defaults = accounts.filter((a) => ['bank', 'cash', 'wallet', 'savings'].includes(a.type)).map((a) => a.id);
  const ids = chosen ?? defaults;
  return (
    <Sheet
      visible
      testID="health-settings-sheet"
      title={t('health.settings')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="health-settings-save"
            label={t('health.saveSettings')}
            onPress={() =>
              void onSave({
                ...(chosen !== undefined ? { cashAccountIds: chosen } : {}),
                targetMonths: Number(target) as 3 | 6 | 12,
                countInvestments: investments,
              })
            }
          />
        </Footer>
      }
    >
      <Text variant="heading-sm">{t('health.countsAsCash')}</Text>
      {accounts.map((a) => (
        <Checkbox
          key={a.id}
          testID={`health-cash-${a.id}`}
          label={a.name}
          checked={ids.includes(a.id)}
          onChange={(on) => setChosen(on ? [...ids, a.id] : ids.filter((x) => x !== a.id))}
        />
      ))}
      <SegmentedControl
        testID="health-target"
        label={t('health.emergencyTarget')}
        value={target}
        onChange={setTarget}
        options={(['3', '6', '12'] as const).map((m) => ({ value: m, label: t('health.targetMonths', { n: m }) }))}
      />
      <Switch testID="health-count-investments" label={t('health.countInvestments')} value={investments} onChange={setInvestments} />
      <Button kind="secondary" label={t('health.essentialCategories')} onPress={() => setEssentialsOpen((v) => !v)} />
      {essentialsOpen
        ? categories.map((c) => (
            <Checkbox
              key={c.id}
              testID={`health-essential-${c.id}`}
              label={c.name}
              checked={!!c.essential}
              onChange={(on) => void onToggleEssential(c.id, on)}
            />
          ))
        : null}
    </Sheet>
  );
}
