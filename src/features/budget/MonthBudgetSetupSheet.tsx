import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Check, Sparkles, Sliders, Tag, Plus, Trash2 } from 'lucide-react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Dropdown, Button } from '../../design';
import { AllocationFramework, STANDARD_FRAMEWORK_PRESETS } from '../../data/rulesModel';
import { EXPENSE_TAXONOMY } from '../../data/categoriesTaxonomy';
import { parseAmount, formatNaira } from '../../money';

export interface ExpectedEarmark {
  id: string;
  name: string;
  amountMinor: bigint;
  targetCategory: string;
}

export interface MonthBudgetConfig {
  month: string;
  expectedIncomeMinor: bigint;
  frameworkId: string;
  titheEnabled: boolean;
  taxEnabled: boolean;
  earmarkedInflows: ExpectedEarmark[];
}

export interface MonthBudgetSetupSheetProps {
  visible: boolean;
  onClose: () => void;
  currentMonth: string;
  initialConfig: MonthBudgetConfig;
  onApplyConfig: (config: MonthBudgetConfig) => void;
}

const CATEGORY_OPTIONS = EXPENSE_TAXONOMY.map((c) => ({
  label: c.name,
  value: c.name,
}));

export function MonthBudgetSetupSheet({
  visible,
  onClose,
  currentMonth,
  initialConfig,
  onApplyConfig,
}: MonthBudgetSetupSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [incomeStr, setIncomeStr] = useState(
    (Number(initialConfig.expectedIncomeMinor) / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
    })
  );
  const [selectedFrameworkId, setSelectedFrameworkId] = useState(initialConfig.frameworkId);
  const [titheEnabled, setTitheEnabled] = useState(initialConfig.titheEnabled);
  const [taxEnabled, setTaxEnabled] = useState(initialConfig.taxEnabled);
  const [earmarks, setEarmarks] = useState<ExpectedEarmark[]>(initialConfig.earmarkedInflows);

  // New Earmark sub-form
  const [showAddEarmark, setShowAddEarmark] = useState(false);
  const [newEarmarkName, setNewEarmarkName] = useState('');
  const [newEarmarkAmount, setNewEarmarkAmount] = useState('');
  const [newEarmarkCategory, setNewEarmarkCategory] = useState('Housing');

  const handleAddEarmark = () => {
    const parsed = parseAmount(newEarmarkAmount);
    if (!parsed.ok || parsed.minor <= 0n || !newEarmarkName.trim()) return;

    setEarmarks((prev) => [
      ...prev,
      {
        id: `earmark-${Date.now()}`,
        name: newEarmarkName.trim(),
        amountMinor: parsed.minor,
        targetCategory: newEarmarkCategory,
      },
    ]);
    setNewEarmarkName('');
    setNewEarmarkAmount('');
    setShowAddEarmark(false);
  };

  const handleRemoveEarmark = (id: string) => {
    setEarmarks((prev) => prev.filter((e) => e.id !== id));
  };

  const handleApply = () => {
    const parsed = parseAmount(incomeStr);
    const incomeMinor = parsed.ok ? parsed.minor : 0n;

    onApplyConfig({
      month: currentMonth,
      expectedIncomeMinor: incomeMinor,
      frameworkId: selectedFrameworkId,
      titheEnabled,
      taxEnabled,
      earmarkedInflows: earmarks,
    });
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Budget Structure for ${currentMonth}`}
      subtitle="Select your financial framework, expected income & earmarked funds for this month"
    >
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
        <View style={styles.form}>
          {/* 1. Expected Income Input */}
          <View style={{ marginBottom: spacing.lg }}>
            <CurrencyInput
              label={`Expected Income for ${currentMonth}`}
              value={incomeStr}
              onChangeText={setIncomeStr}
              placeholder="1,000,000.00"
            />
          </View>

          {/* 2. Choose Monthly Framework */}
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.xs,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: spacing.xs,
              },
            ]}
          >
            Select Budget Framework for this Month
          </Text>

          <View style={{ marginBottom: spacing.lg }}>
            {STANDARD_FRAMEWORK_PRESETS.map((framework: AllocationFramework) => {
              const isSelected = selectedFrameworkId === framework.id;
              return (
                <TouchableOpacity
                  key={framework.id}
                  onPress={() => setSelectedFrameworkId(framework.id)}
                  style={[
                    styles.frameworkCard,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.borderSubtle,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.xs,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text
                      style={{
                        color: isSelected ? colors.primary : colors.textPrimary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: typography.sizes.bodySm,
                      }}
                    >
                      {framework.name}
                    </Text>
                    {isSelected && <Check size={16} color={colors.primary} />}
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontFamily: typography.fonts.regular,
                      marginTop: 2,
                    }}
                  >
                    {framework.tagline}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. Expected Earmarked Inflows (100% Pass-Through, No Tax/Tithe) */}
          <View style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  Expected Earmarked Funds ({earmarks.length})
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                  100% direct pass-through to target envelope (not split, untaxed, non-tithable)
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddEarmark((prev) => !prev)}
                style={[
                  styles.addEarmarkBtn,
                  { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 4 },
                ]}
              >
                <Plus size={13} color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.primary, fontFamily: typography.fonts.medium, marginLeft: 2 }}>
                  {showAddEarmark ? 'Cancel' : 'Add Earmark'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* List of current month earmarks */}
            {earmarks.map((e) => (
              <View
                key={e.id}
                style={[
                  styles.earmarkItem,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.md,
                    padding: spacing.sm,
                    marginTop: spacing.xs,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  },
                ]}
              >
                <View>
                  <Text style={{ fontSize: typography.sizes.bodySm, fontFamily: typography.fonts.medium, color: colors.textPrimary }}>
                    {e.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.primary, fontFamily: typography.fonts.semiBold }}>
                    {formatNaira(e.amountMinor)} → 100% {e.targetCategory}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveEarmark(e.id)} style={{ padding: 4 }}>
                  <Trash2 size={15} color={colors.statusDanger} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Form to add new earmark */}
            {showAddEarmark && (
              <View
                style={[
                  styles.addEarmarkBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.primary,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    marginTop: spacing.sm,
                    borderWidth: 1,
                  },
                ]}
              >
                <TextInput
                  label="Description / Purpose"
                  placeholder="e.g. Rent Support Gift, Project Capital"
                  value={newEarmarkName}
                  onChangeText={setNewEarmarkName}
                  containerStyle={{ marginBottom: spacing.sm }}
                />
                <View style={{ marginBottom: spacing.sm }}>
                  <CurrencyInput
                    label="Earmarked Amount"
                    placeholder="500,000.00"
                    value={newEarmarkAmount}
                    onChangeText={setNewEarmarkAmount}
                  />
                </View>
                <Dropdown
                  label="Target Category Envelope (100% Allocation)"
                  value={newEarmarkCategory}
                  options={CATEGORY_OPTIONS}
                  onSelect={setNewEarmarkCategory}
                  containerStyle={{ marginBottom: spacing.sm }}
                />
                <Button label="Save Earmark" onPress={handleAddEarmark} variant="primary" size="md" />
              </View>
            )}
          </View>

          {/* 4. Month Overrides: Tithe & Tax */}
          <View
            style={[
              styles.overridesCard,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.xl,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <View>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }}>
                  Tithe / Spiritual Giving (10%)
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Deduct 10% off general income before living splits
                </Text>
              </View>
              <Switch
                value={titheEnabled}
                onValueChange={setTitheEnabled}
                trackColor={{ false: colors.borderSubtle, true: colors.primary }}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }}>
                  Tax Provision (Withholding)
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Set aside tax reserve for business/freelance income
                </Text>
              </View>
              <Switch
                value={taxEnabled}
                onValueChange={setTaxEnabled}
                trackColor={{ false: colors.borderSubtle, true: colors.primary }}
              />
            </View>
          </View>

          {/* Apply Button */}
          <Button
            label={`Apply Structure to ${currentMonth}`}
            onPress={handleApply}
            variant="primary"
            size="lg"
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', paddingBottom: 16 },
  sectionTitle: {},
  frameworkCard: {
    borderWidth: 1,
  },
  addEarmarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earmarkItem: {
    borderWidth: 1,
  },
  addEarmarkBox: {},
  overridesCard: {
    borderWidth: 1,
  },
});
