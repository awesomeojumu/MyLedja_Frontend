import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { healthApi } from '@/api/health';
import type { HealthSettings } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import { usePopupParam } from '@/design/usePopupParam';
import {
  RedesignButton,
  RedesignCheckbox,
  RedesignIcon,
  RedesignListRow,
  RedesignSegmented,
  RedesignSheet,
  RedesignSkeleton,
  RedesignStackFrame,
  RedesignSwitch,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import type { Advice, Pillar, PillarKey } from '@/ledger/health';
import { formatNaira, PRIVACY_MASK, roundHalfAwayFromZero } from '@/money';

import { adviceText, healthPage, type HealthPage } from './helpers';

const sp = tokens.space;
const shape = tokens.shape;

const PAGES: Record<Advice['link'], string> = { budget: '/budget', goals: '/goals', debts: '/debts', plan: '/plan' };
const PILLAR_LINK: Record<PillarKey, string> = {
  saving: '/budget',
  runway: '/goals',
  debt_load: '/debts',
  bills: '/plan',
  budget: '/budget',
};
const MONEY_USED = new Set(['income', 'spending', 'cash', 'essential', 'borrowed', 'payments']);

/** Figma factor order (5:2252) plus Budget from specs. */
const FACTOR_ORDER: PillarKey[] = ['saving', 'bills', 'runway', 'debt_load', 'budget'];

const pct = (bp: bigint) => `${roundHalfAwayFromZero(bp, 100n)}%`;
const monthsText = (h: bigint) => `${h / 100n}.${(h % 100n) / 10n}`;

function bandHeadline(page: HealthPage): string {
  const band = page.band ? t(`health.band.${page.band}` as TextKey) : '';
  if (page.change === null || page.change === 0) {
    return page.change === 0 ? t('health.redesign.bandSame', { band }) : band;
  }
  if (page.change > 0) return t('health.redesign.bandUp', { band, n: String(page.change) });
  return t('health.redesign.bandDown', { band, n: String(-page.change) });
}

function factorStatus(score: number | null): string {
  if (score === null) return t('health.notEnough');
  return score >= 80 ? t('health.onTrack') : t('health.room');
}

/** Figma Phone / Health factor subtitles (5:2253+) with specs value wording. */
function factorSubtitle(p: Pillar): string {
  const status = factorStatus(p.score);
  switch (p.key) {
    case 'saving':
      return p.value === null
        ? status
        : t('health.redesign.factor.saving', { pct: pct(p.value), status });
    case 'bills':
      return t('health.redesign.factor.bills', { pct: pct(p.value ?? 0n), status });
    case 'runway':
      return p.value === null
        ? t('health.value.runwayNoSpending')
        : t('health.redesign.factor.runway', {
            months: monthsText(p.value),
            status,
          });
    case 'debt_load':
      return p.value === null
        ? t('health.value.debtNoIncome')
        : t('health.redesign.factor.debt', { pct: pct(p.value), status });
    case 'budget':
      return t('health.redesign.factor.budget', {
        within: String(p.used.within ?? 0n),
        planned: String(p.used.planned ?? 0n),
        status,
      });
  }
}

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 10;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const v = Math.max(0, Math.min(1, score / 100));
  return (
    <View
      testID="redesign-health-ring"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('health.scoreLabel', { score: String(score) })}
      accessibilityValue={{ min: 0, max: 100, now: score }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.progressTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          testID="redesign-health-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.progressFill}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${v * circumference} ${circumference}`}
        />
      </Svg>
      <RedesignText testID="redesign-health-score" variant="display" style={{ fontVariant: ['tabular-nums'] }}>
        {String(score)}
      </RedesignText>
      <RedesignText variant="caption" tone="textSecondary">
        {t('health.redesign.outOf100')}
      </RedesignText>
    </View>
  );
}

/**
 * Figma Mobile App Phone / Health (5:2231).
 * Behind EXPO_PUBLIC_REDESIGN; W0 tokens/components only.
 */
export function RedesignHealthScreen() {
  const { snapshot, repo } = useWorkspace();
  const { user, client } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const onDate = today();
  const month = onDate.slice(0, 7);
  const [explain, setExplain] = useState<PillarKey | null>(null);
  const settingsPopup = usePopupParam({ param: 'healthSettings', openWhen: (v) => v === '1', emptyDraft: {} });
  const privacy = false;
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : formatNaira(v));

  const page = useMemo(() => (snapshot ? healthPage(snapshot, month, onDate) : null), [snapshot, month, onDate]);

  const frame = (body: React.ReactNode) => (
    <RedesignStackFrame
      testID="redesign-health"
      title={t('health.title')}
      onBack={() => router.back()}
      trailing={
        <Pressable
          testID="redesign-health-settings"
          accessibilityRole="button"
          accessibilityLabel={t('health.settings')}
          onPress={() => settingsPopup.openWith('1')}
          style={{
            width: tokens.density.touch.minTarget,
            height: tokens.density.touch.minTarget,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RedesignIcon name="sliders" size={24} color={theme.text} />
        </Pressable>
      }
    >
      {body}
    </RedesignStackFrame>
  );

  if (!snapshot || !page) {
    return frame(
      <View testID="redesign-health-loading" style={{ gap: sp.lg }}>
        <RedesignSkeleton height={200} />
        <RedesignSkeleton height={220} />
      </View>,
    );
  }

  const factors = FACTOR_ORDER.map((key) => page.pillars.find((p) => p.key === key)!).filter(Boolean);
  const next = page.advice[0] ?? null;

  return frame(
    <>
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
        <View
          testID="redesign-health-score-card"
          style={{
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            padding: sp.lg,
            gap: sp.md,
            alignItems: 'center',
          }}
        >
          {page.ready && page.score !== null ? (
            <>
              <ScoreRing score={page.score} />
              <RedesignText testID="redesign-health-band" variant="headline">
                {bandHeadline(page)}
              </RedesignText>
              <RedesignText testID="redesign-health-blurb" tone="textSecondary" style={{ textAlign: 'center' }}>
                {t('health.redesign.scoreBlurb')}
              </RedesignText>
            </>
          ) : (
            <View testID="redesign-health-not-ready" style={{ gap: sp.sm, alignSelf: 'stretch' }}>
              <RedesignText variant="title">{t('health.notReadyTitle')}</RedesignText>
              {page.missing.map((m) => (
                <RedesignText key={m} tone="textSecondary">
                  {t(`health.missing.${m}` as TextKey)}
                </RedesignText>
              ))}
            </View>
          )}
        </View>

        {page.ready ? (
          <>
            <RedesignText variant="label" tone="textSecondary">
              {t('health.redesign.whatMakesUp')}
            </RedesignText>
            <View
              testID="redesign-health-factors"
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                overflow: 'hidden',
              }}
            >
              {factors.map((p) => (
                <RedesignListRow
                  key={p.key}
                  testID={`redesign-health-factor-${p.key}`}
                  title={t(`health.pillar.${p.key}` as TextKey)}
                  subtitle={factorSubtitle(p)}
                  onPress={() => setExplain(p.key)}
                />
              ))}
            </View>
          </>
        ) : null}

        {next ? (
          <View
            testID="redesign-health-next"
            style={{
              backgroundColor: theme.surface,
              borderRadius: shape['radius-lg'],
              borderWidth: 1,
              borderColor: theme.border,
              padding: sp.lg,
              gap: sp.md,
            }}
          >
            <RedesignText variant="label" tone="textSecondary">
              {t('health.redesign.oneNext')}
            </RedesignText>
            <RedesignText testID="redesign-health-advice">{adviceText(next, show)}</RedesignText>
            <RedesignButton
              testID={`redesign-health-advice-${next.pillar}`}
              kind="secondary"
              label={t('health.redesign.goTo', { place: t(`health.link.${next.link}` as TextKey) })}
              onPress={() => router.push(PAGES[next.link])}
            />
          </View>
        ) : null}
      </ScrollView>

      {explain ? (
        <ExplainSheet
          pillar={page.pillars.find((p) => p.key === explain)!}
          show={show}
          onClose={() => setExplain(null)}
          onOpen={(href) => {
            setExplain(null);
            router.push(href);
          }}
        />
      ) : null}

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
    </>,
  );
}

function ExplainSheet({
  pillar,
  show,
  onClose,
  onOpen,
}: {
  pillar: Pillar;
  show: (v: bigint) => string;
  onClose: () => void;
  onOpen: (href: string) => void;
}) {
  return (
    <RedesignSheet
      visible
      testID="redesign-health-explain"
      title={t(`health.pillar.${pillar.key}` as TextKey)}
      onClose={onClose}
    >
      <View style={{ gap: sp.md, paddingBottom: sp.lg }}>
        <RedesignText>{t(`health.formula.${pillar.key}` as TextKey)}</RedesignText>
        {Object.entries(pillar.used).map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.md }}>
            <RedesignText tone="textSecondary">{t(`health.used.${k}` as TextKey)}</RedesignText>
            <RedesignText style={{ fontVariant: ['tabular-nums'] }}>
              {MONEY_USED.has(k) ? show(v) : String(v)}
            </RedesignText>
          </View>
        ))}
        <RedesignText tone="textSecondary">
          {pillar.score === null ? t('health.notEnough') : t('health.pillarScore', { score: String(pillar.score) })}
        </RedesignText>
        <RedesignButton
          kind="secondary"
          label={t(`health.open.${pillar.key}` as TextKey)}
          onPress={() => onOpen(PILLAR_LINK[pillar.key])}
        />
      </View>
    </RedesignSheet>
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
    <RedesignSheet visible testID="redesign-health-settings-sheet" title={t('health.settings')} onClose={onClose}>
      <ScrollView contentContainerStyle={{ gap: sp.md, paddingBottom: sp.xxl }}>
        <RedesignText variant="title">{t('health.countsAsCash')}</RedesignText>
        {accounts.map((a) => (
          <RedesignCheckbox
            key={a.id}
            testID={`redesign-health-cash-${a.id}`}
            label={a.name}
            checked={ids.includes(a.id)}
            onChange={(on) => setChosen(on ? [...ids, a.id] : ids.filter((x) => x !== a.id))}
          />
        ))}
        <RedesignSegmented
          testID="redesign-health-target"
          value={target}
          onChange={(v) => setTarget(v as '3' | '6' | '12')}
          options={(['3', '6', '12'] as const).map((m) => ({ key: m, label: t('health.targetMonths', { n: m }) }))}
        />
        <RedesignSwitch
          testID="redesign-health-count-investments"
          label={t('health.countInvestments')}
          value={investments}
          onChange={setInvestments}
        />
        <RedesignButton
          kind="secondary"
          label={t('health.essentialCategories')}
          onPress={() => setEssentialsOpen((v) => !v)}
        />
        {essentialsOpen
          ? categories.map((c) => (
              <RedesignCheckbox
                key={c.id}
                testID={`redesign-health-essential-${c.id}`}
                label={c.name}
                checked={!!c.essential}
                onChange={(on) => void onToggleEssential(c.id, on)}
              />
            ))
          : null}
        <View style={{ flexDirection: 'row', gap: sp.sm }}>
          <View style={{ flex: 1 }}>
            <RedesignButton kind="secondary" label={t('common.cancel')} onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <RedesignButton
              testID="redesign-health-settings-save"
              label={t('health.saveSettings')}
              onPress={() =>
                void onSave({
                  ...(chosen !== undefined ? { cashAccountIds: chosen } : {}),
                  targetMonths: Number(target) as 3 | 6 | 12,
                  countInvestments: investments,
                })
              }
            />
          </View>
        </View>
      </ScrollView>
    </RedesignSheet>
  );
}
