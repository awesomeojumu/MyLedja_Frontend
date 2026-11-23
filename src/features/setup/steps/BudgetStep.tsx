import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../../design';
import { t } from '../../../i18n';
import { formatNaira } from '../../../money';
import { INCOME_TAXONOMY } from '../../../data/categoriesTaxonomy';
import { STANDARD_FRAMEWORK_PRESETS } from '../../../data/rulesModel';
import { frameworkOf, isSpendingPillar, pillarAmounts, toMinor, totalPercent, type BudgetStyleChoice } from '../plan';
import { Card, Chip, ChipRow, Hint, MoneyField, NumberField, OptionCard, SectionLabel, StepHeading, styles, type StepProps } from '../ui';

export function BudgetStep({ draft, update }: StepProps) {
  const { colors, typography, spacing } = useTheme();
  const [adjusting, setAdjusting] = useState(false);
  const [allSources, setAllSources] = useState(false);

  const fw = frameworkOf(draft);
  const total = totalPercent(fw);
  const amounts = pillarAmounts(fw, toMinor(draft.takeHome));
  const sources = allSources ? INCOME_TAXONOMY : INCOME_TAXONOMY.filter((d) => d.defaultActive || draft.incomeIds.includes(d.id));

  const styleCards: { id: BudgetStyleChoice; title: string; body: string }[] = [
    { id: 'limits', title: t('wiz.budget.style.limits'), body: t('wiz.budget.style.limitsBody') },
    { id: 'envelope', title: t('wiz.budget.style.envelope'), body: t('wiz.budget.style.envelopeBody') },
    { id: 'track', title: t('wiz.budget.style.track'), body: t('wiz.budget.style.trackBody') },
  ];

  return (
    <View>
      <StepHeading title={t('wiz.budget.title')} body={t('wiz.budget.body')} />

      <View style={[styles.row, { gap: spacing.md, alignItems: 'flex-end' }]}>
        <View style={{ flex: 1 }}>
          <MoneyField label={t('wiz.budget.takeHome')} value={draft.takeHome} onChange={(takeHome) => update({ takeHome })} />
        </View>
        <View style={{ marginBottom: 4 }}>
          <Hint style={{ marginBottom: 4 }}>{t('wiz.budget.payday')}</Hint>
          <NumberField
            accessibilityLabel={t('wiz.budget.payday')}
            value={draft.payday}
            min={1}
            max={31}
            onChange={(payday) => update({ payday })}
          />
        </View>
      </View>

      <SectionLabel
        right={
          <TouchableOpacity onPress={() => setAllSources((v) => !v)}>
            <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.sm }}>
              {allSources ? t('setup.categories.showFewer') : t('setup.categories.showAll')}
            </Text>
          </TouchableOpacity>
        }
      >
        {t('wiz.budget.sources')}
      </SectionLabel>
      <ChipRow>
        {sources.map((d) => {
          const on = draft.incomeIds.includes(d.id);
          return (
            <Chip
              key={d.id}
              label={d.name}
              selected={on}
              onPress={() =>
                update((x) => ({
                  incomeIds: on ? (x.incomeIds.length > 1 ? x.incomeIds.filter((i) => i !== d.id) : x.incomeIds) : [...x.incomeIds, d.id],
                }))
              }
            />
          );
        })}
      </ChipRow>

      <SectionLabel>{t('wiz.budget.style')}</SectionLabel>
      {styleCards.map((c) => (
        <OptionCard key={c.id} title={c.title} body={c.body} selected={draft.budgetStyle === c.id} onPress={() => update({ budgetStyle: c.id })} />
      ))}

      <SectionLabel
        right={
          <TouchableOpacity onPress={() => setAdjusting((v) => !v)}>
            <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.sm }}>
              {adjusting ? t('wiz.budget.doneAdjusting') : t('wiz.budget.adjust')}
            </Text>
          </TouchableOpacity>
        }
      >
        {t('wiz.budget.structure')}
      </SectionLabel>
      {STANDARD_FRAMEWORK_PRESETS.map((preset) => {
        const selected = draft.frameworkId === preset.id;
        return (
          <TouchableOpacity
            key={preset.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => !selected && update({ frameworkId: preset.id, percents: {}, pillarOf: {}, amounts: {} })}
          >
            <Card selected={selected}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.body }}>
                    {preset.name}
                  </Text>
                  <Hint>{preset.tagline}</Hint>
                </View>
                {selected && <Check size={18} color={colors.primary} />}
              </View>
              {selected &&
                fw.pillars.map((p) => (
                  <View key={p.id} style={[styles.row, { marginTop: spacing.sm }]}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.sm }}>{p.name}</Text>
                      <Hint>{isSpendingPillar(p) ? t('wiz.budget.spends') : t('wiz.budget.funds')}</Hint>
                    </View>
                    {adjusting ? (
                      <NumberField
                        accessibilityLabel={p.name}
                        value={p.percentage}
                        min={0}
                        max={100}
                        suffix="%"
                        onChange={(n) => update((x) => ({ percents: { ...x.percents, [p.id]: n }, amounts: {} }))}
                      />
                    ) : (
                      <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.medium, width: 44, textAlign: 'right' }}>
                        {p.percentage}%
                      </Text>
                    )}
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: typography.fonts.semiBold,
                        width: 120,
                        textAlign: 'right',
                      }}
                    >
                      {formatNaira(amounts.get(p.id) ?? 0n)}
                    </Text>
                  </View>
                ))}
              {selected && total !== 100 && (
                <Hint tone="danger" style={{ marginTop: spacing.sm }}>
                  {t('wiz.budget.mustBe100', { n: total })}
                </Hint>
              )}
            </Card>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
