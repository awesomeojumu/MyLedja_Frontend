import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Check, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '../../../design';
import { t } from '../../../i18n';
import { formatNaira } from '../../../money';
import { STANDARD_FRAMEWORK_PRESETS } from '../../../data/rulesModel';
import { frameworkOf, isSpendingPillar, pillarAmounts, toMinor, totalPercent, type BudgetStyleChoice } from '../plan';
import { Card, Hint, IconButton, NumberField, OptionCard, SectionLabel, StepHeading, styles, type StepProps } from '../ui';

export function StructureStep({ draft, update }: StepProps) {
  const { colors, typography, spacing } = useTheme();
  const fw = frameworkOf(draft);
  const total = totalPercent(fw);
  const take = toMinor(draft.takeHome);
  const amounts = pillarAmounts(fw, take);

  const setPercent = (pillarId: string, n: number) =>
    update((x) => ({ percents: { ...x.percents, [pillarId]: Math.max(0, Math.min(100, n)) }, amounts: {} }));

  const styleCards: { id: BudgetStyleChoice; title: string; body: string }[] = [
    { id: 'limits', title: t('wiz.budget.style.limits'), body: t('wiz.budget.style.limitsBody') },
    { id: 'envelope', title: t('wiz.budget.style.envelope'), body: t('wiz.budget.style.envelopeBody') },
    { id: 'track', title: t('wiz.budget.style.track'), body: t('wiz.budget.style.trackBody') },
  ];

  return (
    <View>
      <StepHeading title={t('wiz.structure.title')} body={t('wiz.structure.body')} />
      {take === 0n && <Hint style={{ marginBottom: spacing.sm }}>{t('wiz.structure.noIncome')}</Hint>}

      <SectionLabel>{t('wiz.budget.structure')}</SectionLabel>
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
              {selected && (
                <View style={{ marginTop: spacing.sm }}>
                  {fw.pillars.map((p) => (
                    <View key={p.id} style={[styles.row, { marginTop: spacing.sm, gap: 6 }]}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.sm }}>{p.name}</Text>
                        <Hint>{isSpendingPillar(p) ? t('wiz.budget.spends') : t('wiz.budget.funds')}</Hint>
                      </View>
                      <IconButton label={t('wiz.structure.less', { name: p.name })} onPress={() => setPercent(p.id, p.percentage - 5)}>
                        <Minus size={14} color={colors.primary} />
                      </IconButton>
                      <NumberField
                        accessibilityLabel={p.name}
                        value={p.percentage}
                        min={0}
                        max={100}
                        suffix="%"
                        onChange={(n) => setPercent(p.id, n)}
                      />
                      <IconButton label={t('wiz.structure.more', { name: p.name })} onPress={() => setPercent(p.id, p.percentage + 5)}>
                        <Plus size={14} color={colors.primary} />
                      </IconButton>
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, minWidth: 96, textAlign: 'right' }}>
                        {formatNaira(amounts.get(p.id) ?? 0n)}
                      </Text>
                    </View>
                  ))}
                  <Hint style={{ marginTop: spacing.sm }} tone={total === 100 ? 'success' : 'danger'}>
                    {total === 100 ? t('wiz.budget.total', { n: total }) : t('wiz.budget.mustBe100', { n: total })}
                  </Hint>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        );
      })}

      <SectionLabel>{t('wiz.budget.style')}</SectionLabel>
      {styleCards.map((c) => (
        <OptionCard key={c.id} title={c.title} body={c.body} selected={draft.budgetStyle === c.id} onPress={() => update({ budgetStyle: c.id })} />
      ))}
    </View>
  );
}
