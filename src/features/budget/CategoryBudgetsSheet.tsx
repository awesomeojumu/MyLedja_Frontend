import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { formatNaira, toInputText, parseAmount } from '../../money';
import type { CategoryEnvelope } from './CategoryEnvelopeRow';

import { t } from '../../i18n';
import { useSyncOnChange } from '../../lib/useSyncOnChange';
export interface CategoryBudgetsSheetProps {
  visible: boolean;
  onClose: () => void;
  envelopes: CategoryEnvelope[];
  expectedIncomeMinor: bigint;
  onSaveBudgets: (updatedLimits: Record<string, bigint>) => void;
}

export function CategoryBudgetsSheet({
  visible,
  onClose,
  envelopes,
  expectedIncomeMinor,
  onSaveBudgets,
}: CategoryBudgetsSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [inputMap, setInputMap] = useState<Record<string, string>>({});

  // Fill the fields from the props when the sheet opens or what it shows changes.
  useSyncOnChange([visible, envelopes], () => {
    if (visible) {
      const map: Record<string, string> = {};
      envelopes.forEach((env) => {
        map[env.id] = toInputText(env.plannedMinor);
      });
      setInputMap(map);
    }
  });

  // Compute live total planned
  const totalPlannedMinor = Object.values(inputMap).reduce((sum, str) => {
    const parsed = parseAmount(str);
    return sum + (parsed.ok ? parsed.minor : 0n);
  }, 0n);

  const diffMinor = expectedIncomeMinor - totalPlannedMinor;
  const isOver = diffMinor < 0n;

  const handleSave = () => {
    const updated: Record<string, bigint> = {};
    envelopes.forEach((env) => {
      const str = inputMap[env.id] || '0';
      const parsed = parseAmount(str);
      updated[env.id] = parsed.ok ? parsed.minor : env.plannedMinor;
    });
    onSaveBudgets(updated);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('ui.categoryBudgetsSheet.categoryBudgets')}
      subtitle="Set target monthly envelope limits for each active category"
    >
      <View style={{ width: '100%' }}>
        {/* Budget Allocation Funnel Bar */}
        <View
          style={[
            styles.funnelCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 10, textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 }}>
                {t('ui.categoryBudgetsSheet.expectedIncome')}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: typography.fonts.semiBold, color: colors.textPrimary, marginTop: 1 }}>
                {formatNaira(expectedIncomeMinor)}
              </Text>
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 }}>
                {t('ui.categoryBudgetsSheet.totalBudgeted')}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: typography.fonts.semiBold, color: colors.primary, marginTop: 1 }}>
                {formatNaira(totalPlannedMinor)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 }}>
                {isOver ? 'Overbudget' : 'Unallocated'}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: typography.fonts.semiBold,
                  color: isOver ? colors.statusDanger : colors.primary,
                  marginTop: 1,
                }}
              >
                {formatNaira(diffMinor < 0n ? -diffMinor : diffMinor)}
              </Text>
            </View>
          </View>
        </View>

        {/* Scrollable list of category envelopes */}
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {envelopes.map((env) => (
            <View
              key={env.id}
              style={[
                styles.categoryRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.md,
                  padding: spacing.sm + 2,
                  marginBottom: spacing.xs + 2,
                },
              ]}
            >
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ fontSize: 13, fontFamily: typography.fonts.semiBold, color: colors.textPrimary }}>
                  {env.name}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
                  {env.group}
                </Text>
                {env.subcategories && env.subcategories.length > 0 && (
                  <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                    {env.subcategories.slice(0, 3).join(', ')}
                    {env.subcategories.length > 3 ? ` +${env.subcategories.length - 3}` : ''}
                  </Text>
                )}
              </View>

              <View style={{ width: 140 }}>
                <CurrencyInput
                  value={inputMap[env.id] || ''}
                  onChangeText={(val) => {
                    setInputMap((prev) => ({ ...prev, [env.id]: val }));
                  }}
                  placeholder="0.00"
                />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ marginTop: spacing.lg }}>
          <Button label={t('ui.categoryBudgetsSheet.saveAllCategoryBudgets')} onPress={handleSave} variant="primary" size="lg" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  funnelCard: {
    borderWidth: 1,
  },
  categoryRow: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
