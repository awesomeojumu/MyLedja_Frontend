import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../design';
import { t } from '../../../i18n';
import { formatNaira } from '../../../money';
import { INCOME_TAXONOMY } from '../../../data/categoriesTaxonomy';
import { toMinor } from '../plan';
import { Chip, ChipRow, Hint, MoneyField, NumberField, SectionLabel, StepHeading, styles, type StepProps } from '../ui';

export function IncomeStep({ draft, update }: StepProps) {
  const { colors, typography, spacing } = useTheme();
  const [allSources, setAllSources] = useState(false);
  const sources = allSources ? INCOME_TAXONOMY : INCOME_TAXONOMY.filter((d) => d.defaultActive || draft.incomeIds.includes(d.id));
  const take = toMinor(draft.takeHome);

  return (
    <View>
      <StepHeading title={t('wiz.income.title')} body={t('wiz.income.body')} />

      <View style={[styles.row, { gap: spacing.md, alignItems: 'flex-end' }]}>
        <View style={{ flex: 1 }}>
          <MoneyField label={t('wiz.budget.takeHome')} value={draft.takeHome} onChange={(takeHome) => update({ takeHome })} />
        </View>
        <View style={{ marginBottom: 4 }}>
          <Hint style={{ marginBottom: 4 }}>{t('wiz.budget.payday')}</Hint>
          <NumberField accessibilityLabel={t('wiz.budget.payday')} value={draft.payday} min={1} max={31} onChange={(payday) => update({ payday })} />
        </View>
      </View>
      {take > 0n && <Hint style={{ marginTop: spacing.xs }}>{t('wiz.income.perYear', { amount: formatNaira(take * 12n) })}</Hint>}

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
    </View>
  );
}
