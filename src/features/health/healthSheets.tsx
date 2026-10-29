import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { Button, Checkbox, Footer, SegmentedControl, Sheet, Switch, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { HealthSettings } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

const sp = tokens.spacing;

/** PU-44 Health settings */
export function HealthSettingsSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const initial = useMemo(() => (snapshot ? repo.defaultHealthSettings(snapshot) : null), [snapshot, repo]);
  const [draft, setDraft] = useState<HealthSettings | null>(initial);
  const [essentialsOpen, setEssentialsOpen] = useState(false);

  if (!snapshot || !draft) return null;

  const accounts = snapshot.accounts.filter((a) => !a.archived);
  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden);

  return (
    <Sheet
      visible
      testID="health-settings-sheet"
      title={t('health.settingsTitle')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="health-settings-save"
            label={t('health.saveSettings')}
            onPress={() => {
              void repo.saveHealthSettings(draft).then(() => {
                toast.show(t('health.settingsSaved'));
                onClose();
              });
            }}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <Text variant="heading-sm">{t('health.countsAsCash')}</Text>
        {accounts.map((a) => (
          <Checkbox
            key={a.id}
            testID={`health-cash-${a.id}`}
            label={a.name}
            checked={draft.cashAccountIds.includes(a.id)}
            onChange={() =>
              setDraft({
                ...draft,
                cashAccountIds: draft.cashAccountIds.includes(a.id)
                  ? draft.cashAccountIds.filter((id) => id !== a.id)
                  : [...draft.cashAccountIds, a.id],
              })
            }
          />
        ))}
        <SegmentedControl
          testID="health-emergency"
          label={t('health.emergencyTarget')}
          value={String(draft.emergencyMonths)}
          onChange={(v) => setDraft({ ...draft, emergencyMonths: Number(v) as 3 | 6 | 12 })}
          options={[
            { value: '3', label: t('health.months3') },
            { value: '6', label: t('health.months6') },
            { value: '12', label: t('health.months12') },
          ]}
        />
        <Switch
          testID="health-investments"
          label={t('health.countInvestments')}
          value={draft.countInvestmentsInRunway}
          onChange={(countInvestmentsInRunway) => setDraft({ ...draft, countInvestmentsInRunway })}
        />
        <Button kind="secondary" label={t('health.essentialCategories')} onPress={() => setEssentialsOpen((v) => !v)} />
        {essentialsOpen
          ? categories.map((c) => (
              <Checkbox
                key={c.id}
                testID={`health-essential-${c.id}`}
                label={c.name}
                checked={draft.essentialCategoryIds.includes(c.id)}
                onChange={() =>
                  setDraft({
                    ...draft,
                    essentialCategoryIds: draft.essentialCategoryIds.includes(c.id)
                      ? draft.essentialCategoryIds.filter((id) => id !== c.id)
                      : [...draft.essentialCategoryIds, c.id],
                  })
                }
              />
            ))
          : null}
      </View>
    </Sheet>
  );
}

/** PU-45 Share health report */
export function ShareHealthSheet({
  score,
  band,
  pillars,
  month,
  onClose,
}: {
  score: number | null;
  band: string;
  pillars: { key: string; score: number | null }[];
  month: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [hideAmounts, setHideAmounts] = useState(true);

  const text = hideAmounts
    ? t('health.shareTextHidden', { band, month })
    : t('health.shareText', { score: String(score ?? '—'), band, month });

  return (
    <Sheet
      visible
      testID="share-health-sheet"
      title={t('health.shareTitle')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="share-health-confirm"
            label={Platform.OS === 'web' ? t('health.downloadImage') : t('health.share')}
            onPress={() => {
              if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                void navigator.clipboard.writeText(text);
                toast.show(t('health.copied'));
              } else {
                toast.show(t('health.shareReady'));
              }
              onClose();
            }}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <View testID="share-health-preview" style={{ gap: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{band}</Text>
          <Text>
            {hideAmounts ? t('health.scoreHidden') : t('health.scoreLabel', { score: String(score ?? '—') })}
          </Text>
          {pillars.map((p) => (
            <Text key={p.key} testID={`share-pillar-${p.key}`}>
              {t(`health.pillar.${p.key}` as 'health.pillar.saving')}:{' '}
              {hideAmounts
                ? p.score === null
                  ? t('health.notEnough')
                  : t('health.pillarWords', { score: String(p.score) })
                : p.score === null
                  ? t('health.notEnough')
                  : String(p.score)}
            </Text>
          ))}
          <Text tone="textSecondary">{month}</Text>
        </View>
        <Switch testID="share-hide-amounts" label={t('health.hideAmounts')} value={hideAmounts} onChange={setHideAmounts} />
        {Platform.OS === 'web' ? (
          <Button kind="secondary" label={t('health.copyText')} onPress={() => {
            void navigator.clipboard?.writeText(text);
            toast.show(t('health.copied'));
          }} />
        ) : null}
      </View>
    </Sheet>
  );
}

/** Pure helpers for Health scoring (TECH-SPEC 6.10) — enough for UI + unit tests. */
export function scoreBand(score: number): 'strong' | 'okay' | 'needsAttention' {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'okay';
  return 'needsAttention';
}

export function shareHasNaira(text: string): boolean {
  return /₦|\bNGN\b/.test(text);
}
