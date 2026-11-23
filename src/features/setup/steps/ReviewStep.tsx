import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../design';
import { t } from '../../../i18n';
import { formatNaira } from '../../../money';
import { EXPENSE_TAXONOMY } from '../../../data/categoriesTaxonomy';
import { SAVE_OR_INVEST_TAXONOMY_ID } from '../../categories/catalog';
import { frameworkOf, summarize, toMinor } from '../plan';
import { Card, Hint, StepHeading, styles, type StepProps } from '../ui';

export function ReviewStep({ draft, goTo }: StepProps) {
  const { colors, typography, spacing } = useTheme();
  const s = summarize(draft);
  const fw = frameworkOf(draft);
  const cats = draft.expenseIds.filter((id) => id !== SAVE_OR_INVEST_TAXONOMY_ID);
  const subs = cats.reduce((n, id) => {
    const def = EXPENSE_TAXONOMY.find((d) => d.id === id);
    return n + (draft.subcategories[id] ?? def?.subcategories ?? []).length;
  }, 0);

  const section = (title: string, step: number, lines: string[]) => (
    <Card key={title}>
      <View style={styles.row}>
        <Text style={{ flex: 1, color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.body }}>{title}</Text>
        <TouchableOpacity onPress={() => goTo(step)} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold }}>{t('wiz.edit')}</Text>
        </TouchableOpacity>
      </View>
      {lines.map((l) => (
        <Hint key={l} style={{ marginTop: 4 }}>
          {l}
        </Hint>
      ))}
    </Card>
  );

  const left = s.leftToPlan;
  return (
    <View>
      <StepHeading title={t('wiz.review.title')} body={t('wiz.review.body')} />

      {section(t('wiz.review.accounts'), 1, [t('wiz.review.accountsLine', { n: draft.accounts.length, amount: formatNaira(s.accountsTotal) })])}
      {section(t('wiz.review.income'), 2, [t('wiz.review.incomeLine', { amount: formatNaira(s.takeHome), day: draft.payday })])}
      {section(
        t('wiz.review.structure'),
        3,
        [fw.name, ...s.pillars.map((p) => t('wiz.review.pillarLine', { name: p.pillar.name, planned: formatNaira(p.planned), target: formatNaira(p.target) }))],
      )}
      {section(t('wiz.review.bills'), 4, [
        t('wiz.review.billsLine', { n: draft.bills.length, amount: formatNaira(s.billsTotal) }),
        t('wiz.review.debtsLine', { n: draft.debts.length, amount: formatNaira(s.debtsOwed) }),
      ])}
      {section(t('wiz.review.goals'), 5, [t('wiz.review.goalsLine', { n: draft.goals.length, amount: formatNaira(s.goalsMonthly) })])}
      {section(t('wiz.review.categories'), 6, [
        t('wiz.review.categoriesLine', { cats: cats.length + draft.customCategories.length, subs, income: draft.incomeIds.length }),
      ])}

      <Card selected={toMinor(draft.takeHome) > 0n && left === 0n}>
        <View style={styles.row}>
          <Text style={{ flex: 1, color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md }}>
            {t('wiz.review.left')}
          </Text>
          <Text
            style={{
              color: left < 0n ? colors.statusDanger : colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.md,
            }}
          >
            {formatNaira(left)}
          </Text>
        </View>
        <Hint style={{ marginTop: spacing.xs }} tone={left < 0n ? 'danger' : left === 0n ? 'success' : 'muted'}>
          {toMinor(draft.takeHome) === 0n
            ? t('wiz.review.noIncome')
            : left === 0n
              ? t('wiz.review.balanced')
              : left < 0n
                ? t('wiz.review.over', { amount: formatNaira(-left) })
                : t('wiz.review.under', { amount: formatNaira(left) })}
        </Hint>
      </Card>
    </View>
  );
}
