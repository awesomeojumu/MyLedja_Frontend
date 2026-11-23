import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings, ChevronDown, ChevronUp, Tag } from 'lucide-react-native';
import { useTheme, BottomSheet, CurrencyInput, Button, Dropdown, formatCurrencyString } from '../../design';
import { formatNaira, toInputText, parseAmount } from '../../money';
import { EXPENSE_TAXONOMY } from '../../data/categoriesTaxonomy';

import { t } from '../../i18n';
import { useSyncOnChange } from '../../lib/useSyncOnChange';
export interface IncomeCategoryConfig {
  id: string;
  name: string;
  totalPlannedMinor: bigint;
  subBudgets: Record<string, bigint>;
  isEarmarked?: boolean;
  targetExpenseCategory?: string;
}

export interface EditIncomeBudgetSheetProps {
  visible: boolean;
  onClose: () => void;
  activeIncomeCategories: { id: string; name: string; subcategories: string[] }[];
  currentIncomeBudgets?: Record<string, IncomeCategoryConfig>;
  onSaveIncomeBudgets: (
    totalExpectedMinor: bigint,
    budgets: Record<string, IncomeCategoryConfig>
  ) => void;
}

const EXPENSE_OPTIONS = EXPENSE_TAXONOMY.map((c) => ({
  label: c.name,
  value: c.name,
}));

export function EditIncomeBudgetSheet({
  visible,
  onClose,
  activeIncomeCategories,
  currentIncomeBudgets,
  onSaveIncomeBudgets,
}: EditIncomeBudgetSheetProps) {
  const { colors, typography, radii } = useTheme();
  const router = useRouter();

  // categoryId -> subcategoryName -> input string
  const [subInputs, setSubInputs] = useState<Record<string, Record<string, string>>>({});
  // categoryId -> boolean expanded
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  // categoryId -> earmark settings
  const [earmarkMap, setEarmarkMap] = useState<
    Record<string, { isEarmarked: boolean; targetCategory: string }>
  >({});

  // Initialize inputs on open
  // Fill the fields from the props when the sheet opens or what it shows changes.
  useSyncOnChange([visible, activeIncomeCategories, currentIncomeBudgets], () => {
    if (!visible) return;

    const initialSubInputs: Record<string, Record<string, string>> = {};
    const initialEarmarks: Record<string, { isEarmarked: boolean; targetCategory: string }> = {};

    activeIncomeCategories.forEach((cat) => {
      initialSubInputs[cat.id] = {};
      const savedConfig = currentIncomeBudgets?.[cat.id];

      if (savedConfig) {
        initialEarmarks[cat.id] = {
          isEarmarked: Boolean(savedConfig.isEarmarked),
          targetCategory: savedConfig.targetExpenseCategory || '',
        };

        cat.subcategories.forEach((sub) => {
          const val = savedConfig.subBudgets?.[sub];
          initialSubInputs[cat.id]![sub] = val !== undefined ? formatCurrencyString(toInputText(val)) : '';
        });
      } else {
        // Defaults: Regular framework income (NOT earmarked)
        initialEarmarks[cat.id] = {
          isEarmarked: false,
          targetCategory: '',
        };

        cat.subcategories.forEach((sub) => {
          initialSubInputs[cat.id]![sub] = '';
        });
      }
    });

    setSubInputs(initialSubInputs);
    setEarmarkMap(initialEarmarks);
  });

  // Compute live category totals and total expected income
  const { categoryTotals, totalExpectedMinor } = useMemo(() => {
    const catTotals: Record<string, bigint> = {};
    let grandTotal = 0n;

    activeIncomeCategories.forEach((cat) => {
      let sum = 0n;
      const catInputs = subInputs[cat.id] || {};
      Object.values(catInputs).forEach((str) => {
        const parsed = parseAmount(str);
        if (parsed.ok) sum += parsed.minor;
      });
      catTotals[cat.id] = sum;
      grandTotal += sum;
    });

    return { categoryTotals: catTotals, totalExpectedMinor: grandTotal };
  }, [activeIncomeCategories, subInputs]);

  const toggleExpand = (catId: string) => {
    setExpandedMap((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleSave = () => {
    const result: Record<string, IncomeCategoryConfig> = {};

    activeIncomeCategories.forEach((cat) => {
      const catInputs = subInputs[cat.id] || {};
      const subBudgets: Record<string, bigint> = {};

      Object.entries(catInputs).forEach(([sub, str]) => {
        const parsed = parseAmount(str);
        if (parsed.ok && parsed.minor > 0n) {
          subBudgets[sub] = parsed.minor;
        }
      });

      const earmarkInfo = earmarkMap[cat.id];
      result[cat.id] = {
        id: cat.id,
        name: cat.name,
        totalPlannedMinor: categoryTotals[cat.id] || 0n,
        subBudgets,
        isEarmarked: earmarkInfo?.isEarmarked || false,
        targetExpenseCategory: earmarkInfo?.isEarmarked ? earmarkInfo.targetCategory : undefined,
      };
    });

    onSaveIncomeBudgets(totalExpectedMinor, result);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('ui.editIncomeBudgetSheet.planMonthlyIncome')}
      subtitle="Configure expected earnings by income stream & subcategory"
    >
      <View style={{ width: '100%' }}>
        {/* Compact Header Summary Card */}
        <View
          style={[
            styles.totalCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              paddingVertical: 8,
              paddingHorizontal: 10,
              marginBottom: 8,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  color: colors.textSecondary,
                  letterSpacing: 0.5,
                  fontFamily: typography.fonts.semiBold,
                }}
              >
                {t('ui.editIncomeBudgetSheet.totalExpectedIncome')}
              </Text>
              <Text
                style={{
                  fontSize: 17,
                  fontFamily: typography.fonts.semiBold,
                  color: colors.statusSuccess,
                  marginTop: 1,
                }}
              >
                {formatNaira(totalExpectedMinor)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  backgroundColor: colors.statusSuccessLight,
                  borderRadius: radii.full,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontFamily: typography.fonts.semiBold, color: colors.statusSuccess }}>
                  {activeIncomeCategories.length}{' '}{t('ui.editIncomeBudgetSheet.streams')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  router.push('/settings');
                }}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Settings size={10} color={colors.primary} style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 10, color: colors.primary, fontFamily: typography.fonts.medium }}>
                  {t('ui.editIncomeBudgetSheet.settings')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* List of Income Categories */}
        <ScrollView
          style={{ maxHeight: 400 }}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          {activeIncomeCategories.map((cat) => {
            const catTotal = categoryTotals[cat.id] || 0n;
            const isExpanded = expandedMap[cat.id] !== false; // Default expanded
            const earmark = earmarkMap[cat.id] || { isEarmarked: false, targetCategory: 'Housing' };

            return (
              <View
                key={cat.id}
                style={[
                  styles.categoryBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.md,
                    marginBottom: 6,
                    overflow: 'hidden',
                  },
                ]}
              >
                {/* Category Header Row */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(cat.id)}
                  style={[
                    styles.catHeader,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                    },
                  ]}
                >
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12.5, fontFamily: typography.fonts.semiBold, color: colors.textPrimary }}>
                      {cat.name}
                    </Text>
                    {earmark.isEarmarked && (
                      <View
                        style={{
                          backgroundColor: colors.statusWarningLight,
                          borderRadius: radii.full,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <Text style={{ fontSize: 9.5, color: colors.statusWarning, fontFamily: typography.fonts.medium }}>
                          {t('ui.editIncomeBudgetSheet.earmarked')}{earmark.targetCategory})
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, fontFamily: typography.fonts.semiBold, color: colors.statusSuccess }}>
                      {formatNaira(catTotal)}
                    </Text>
                    {isExpanded ? (
                      <ChevronUp size={12} color={colors.textSecondary} />
                    ) : (
                      <ChevronDown size={12} color={colors.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Subcategories list when expanded */}
                {isExpanded && (
                  <View style={{ padding: 6 }}>
                    {cat.subcategories.map((sub) => {
                      const currentVal = subInputs[cat.id]?.[sub] || '';

                      return (
                        <View
                          key={sub}
                          style={[
                            styles.subRow,
                            {
                              borderColor: colors.borderSubtle,
                              paddingVertical: 3.5,
                              paddingHorizontal: 6,
                              marginBottom: 2,
                            },
                          ]}
                        >
                          <Text style={{ flex: 1, fontSize: 12, color: colors.textPrimary, fontFamily: typography.fonts.medium }}>
                            {sub}
                          </Text>
                          <View style={{ width: 125 }}>
                            <CurrencyInput
                              compact
                              value={currentVal}
                              onChangeText={(val) => {
                                setSubInputs((prev) => ({
                                  ...prev,
                                  [cat.id]: {
                                    ...(prev[cat.id] || {}),
                                    [sub]: val,
                                  },
                                }));
                              }}
                              placeholder="0.00"
                            />
                          </View>
                        </View>
                      );
                    })}

                    {/* Earmark Selector for this income stream */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 4,
                        paddingTop: 4,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.borderSubtle,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          const nextEarmarked = !earmark.isEarmarked;
                          setEarmarkMap((prev) => ({
                            ...prev,
                            [cat.id]: {
                              isEarmarked: nextEarmarked,
                              targetCategory: earmark.targetCategory || (EXPENSE_OPTIONS[0]?.value || 'Needs'),
                            },
                          }));
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Tag size={10} color={earmark.isEarmarked ? colors.statusWarning : colors.textTertiary} />
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: typography.fonts.medium,
                            color: earmark.isEarmarked ? colors.statusWarning : colors.textSecondary,
                          }}
                        >
                          {earmark.isEarmarked ? 'Earmarked Inflow' : 'Standard Framework Allocation'}
                        </Text>
                      </TouchableOpacity>

                      {earmark.isEarmarked && (
                        <View style={{ width: 125 }}>
                          <Dropdown
                            options={EXPENSE_OPTIONS}
                            value={earmark.targetCategory}
                            onSelect={(val) => {
                              setEarmarkMap((prev) => ({
                                ...prev,
                                [cat.id]: {
                                  ...earmark,
                                  targetCategory: val,
                                },
                              }));
                            }}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Save Button */}
        <View style={{ marginTop: 8 }}>
          <Button
            label={`Save Expected Income · ${formatNaira(totalExpectedMinor)}`}
            onPress={handleSave}
            variant="primary"
            size="md"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    borderWidth: 1,
  },
  categoryBox: {
    borderWidth: 1,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
