import { useGlobalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Placeholder, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerBalance, monthIncome, monthSpent, periodTotals, monthsEndingAt, prevMonth } from '@/ledger';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { HealthSettingsSheet, ShareHealthSheet, scoreBand } from './healthSheets';

const sp = tokens.spacing;

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** F5.4 Health page + PU-44/45 */
export function HealthScreen() {
  const { snapshot, repo } = useWorkspace();
  const params = useGlobalSearchParams<{ healthSettings?: string }>();
  const [settingsOpen, setSettingsOpen] = useState(params.healthSettings === '1');
  const [shareOpen, setShareOpen] = useState(false);

  const health = useMemo(() => {
    if (!snapshot) return null;
    const settings = repo.defaultHealthSettings(snapshot);
    const month = today().slice(0, 7);
    const complete = monthsEndingAt(prevMonth(month), 3);
    const totals = periodTotals(snapshot.events);
    let incomeSum = 0n;
    let spentSum = 0n;
    const essentials = new Set(settings.essentialCategoryIds);
    const essentialSpend: bigint[] = [];
    for (const m of complete) {
      incomeSum += monthIncome(snapshot.chart, totals, m);
      spentSum += monthSpent(snapshot.chart, totals, m);
      let ess = 0n;
      for (const c of snapshot.categories) {
        if (!essentials.has(c.id)) continue;
        ess += totals.get(m)?.get(c.id) ?? 0n;
      }
      essentialSpend.push(ess);
    }
    const savingRatio = incomeSum > 0n ? Number((incomeSum - spentSum) * 100n) / Number(incomeSum) : 0;
    const saving = clampScore(savingRatio <= 0 ? 0 : savingRatio >= 20 ? 100 : (savingRatio / 20) * 100);

    const liquid = settings.cashAccountIds.reduce((s, id) => s + shownAsset(snapshot, id), 0n);
    const invest = settings.countInvestmentsInRunway
      ? snapshot.holdings.reduce((s, h) => s + ledgerBalance(h.ledgerAccountId, snapshot.events), 0n)
      : 0n;
    const cash = liquid + invest;
    const sorted = [...essentialSpend].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0n;
    const runwayMonths = median > 0n ? Number(cash) / Number(median) : 0;
    const target = settings.emergencyMonths;
    const runway = clampScore(runwayMonths <= 0 ? 0 : runwayMonths >= target ? 100 : (runwayMonths / target) * 100);

    const pillars = [
      { key: 'saving', score: complete.length >= 2 ? saving : null, weight: 25 },
      { key: 'runway', score: complete.length >= 2 ? runway : null, weight: 25 },
      { key: 'debt', score: null as number | null, weight: 20 },
      { key: 'bills', score: null as number | null, weight: 15 },
      { key: 'budget', score: null as number | null, weight: 15 },
    ];
    const ready = pillars.filter((p) => p.score !== null);
    const weightSum = ready.reduce((s, p) => s + p.weight, 0);
    const score =
      ready.length >= 3 && weightSum > 0
        ? Math.round(ready.reduce((s, p) => s + (p.score! * p.weight) / weightSum, 0))
        : null;
    return { score, pillars, month, settings, cash, runwayMonths, target };
  }, [snapshot, repo]);

  const band = health?.score !== null && health?.score !== undefined ? scoreBand(health.score) : 'okay';

  return (
    <AppFrame title={t('health.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        {!health || !snapshot ? (
          <Placeholder height={120} />
        ) : (
          <>
            <Card testID="health-score" style={{ gap: sp['spacing-sm'] }}>
              {health.score === null ? (
                <Text>{t('health.notReady')}</Text>
              ) : (
                <>
                  <Text variant="display-lg">{health.score}</Text>
                  <Text>{t(`health.band.${band}`)}</Text>
                </>
              )}
              <Text tone="textSecondary">
                {t('health.runwayLine', { months: health.runwayMonths.toFixed(1), target: String(health.target) })}
              </Text>
              <Text tone="textSecondary">{t('health.cashLine', { amount: formatNaira(health.cash) })}</Text>
            </Card>
            {health.pillars.map((p) => (
              <Card key={p.key} testID={`health-pillar-${p.key}`}>
                <Text variant="heading-sm">{t(`health.pillar.${p.key}` as 'health.pillar.saving')}</Text>
                <Text>{p.score === null ? t('health.notEnough') : String(p.score)}</Text>
              </Card>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
              <Button testID="health-settings" kind="secondary" label={t('health.settings')} onPress={() => setSettingsOpen(true)} />
              <Button testID="health-share" label={t('health.share')} onPress={() => setShareOpen(true)} />
            </View>
          </>
        )}
      </ScrollView>
      {settingsOpen ? <HealthSettingsSheet onClose={() => setSettingsOpen(false)} /> : null}
      {shareOpen && health ? (
        <ShareHealthSheet
          score={health.score}
          band={t(`health.band.${band}`)}
          pillars={health.pillars}
          month={health.month}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </AppFrame>
  );
}

function shownAsset(snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>, id: string): bigint {
  const account = snapshot.accounts.find((a) => a.id === id);
  if (!account) return 0n;
  const bal = ledgerBalance(id, snapshot.events);
  return account.type === 'card' || account.type === 'loan' ? 0n : bal;
}
