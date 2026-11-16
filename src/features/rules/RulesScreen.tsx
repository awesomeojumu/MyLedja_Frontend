import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Minus,
  Zap,
  Sliders,
  ShieldCheck,
  Check,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Tag,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Receipt,
  Heart,
  Landmark,
  Trash2,
  Settings,
  Layers,
} from 'lucide-react-native';
import { useTheme, Button, CurrencyInput } from '../../design';
import { useFinancialRules } from './RulesContext';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { AllocationPillar } from '../../data/rulesModel';
import { AddEarmarkedRuleSheet } from './AddEarmarkedRuleSheet';
import { formatNaira, parseAmount } from '../../money';

type RulesTab = 'framework' | 'tax_tithe' | 'earmarked' | 'sub_allocation';

export function RulesScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const {
    activeFramework,
    frameworkPresets,
    taxRule,
    titheRule,
    earmarkedRules,
    subAllocation,
    applyPresetFramework,
    updatePillarPercentage,
    updateTaxRule,
    updateTitheRule,
    addEarmarkedRule,
    toggleEarmarkedRule,
    deleteEarmarkedRule,
    resetRulesToDefault,
    simulateInflow,
    totalPercentage,
    isTotal100Percent,
    setCategorySubAllocation,
    setSubcategoryAllocation,
    autoBalanceCategories,
    getCategoryPercentage,
  } = useFinancialRules();

  const { activeExpenseCategories, enabledSubcategories } = useCategoryPreferences();

  const [activeTab, setActiveTab] = useState<RulesTab>('framework');
  const [addEarmarkVisible, setAddEarmarkVisible] = useState(false);
  const [selectedPillarId, setSelectedPillarId] = useState<string>('living_needs');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const fallbackPillar: AllocationPillar = {
    id: 'living_needs',
    name: 'Living & Needs',
    percentage: 50,
    color: '#2563EB',
    icon: 'Home',
    purposeAccountType: 'operating',
    description: 'Living expenses',
    mappedExpenseCategories: ['Housing', 'Food', 'Transportation', 'Utilities', 'Healthcare'],
  };

  // Active pillar to sub-allocate
  const selectedPillar: AllocationPillar = useMemo(() => {
    return (
      activeFramework.pillars.find((p) => p.id === selectedPillarId) ||
      activeFramework.pillars.find(
        (p) => p.id === 'living_needs' || p.id === 'living' || p.id === 'needs' || p.id === 'spending'
      ) ||
      activeFramework.pillars[0] ||
      fallbackPillar
    );
  }, [activeFramework, selectedPillarId]);

  // Target categories for the selected pillar (considering major selected categories in Settings)
  const targetCategories = useMemo(() => {
    if (!selectedPillar) return activeExpenseCategories;
    const mapped = selectedPillar.mappedExpenseCategories || [];
    const inPillar = activeExpenseCategories.filter((cat) =>
      mapped.some((m) => m.toLowerCase() === cat.name.toLowerCase())
    );
    return inPillar.length > 0 ? inPillar : activeExpenseCategories;
  }, [selectedPillar, activeExpenseCategories]);

  // Total percentage allocated across target categories
  const totalPillarAllocated = useMemo(() => {
    return targetCategories.reduce((sum, cat) => {
      return sum + getCategoryPercentage(cat.name, 0);
    }, 0);
  }, [targetCategories, getCategoryPercentage, subAllocation]);

  const isPillarSubBalanced = totalPillarAllocated === 100;

  // Live Simulator State
  const [testAmountStr, setTestAmountStr] = useState('100,000.00');
  const [testCategory, setTestCategory] = useState('Employment');
  const [testNotes, setTestNotes] = useState('');

  // Compute live simulation
  const simulation = useMemo(() => {
    const parsed = parseAmount(testAmountStr);
    const amountMinor = parsed.ok ? parsed.minor : 10000000n; // Default ₦100,000
    return simulateInflow(amountMinor, testCategory, testNotes);
  }, [testAmountStr, testCategory, testNotes, simulateInflow]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            borderBottomColor: colors.borderSubtle,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { padding: spacing.xs }]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[
              styles.screenTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.lg,
              },
            ]}
          >
            Financial Blueprint & Rules
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Automate how every incoming Naira is allocated across life & wealth
          </Text>
        </View>

        <TouchableOpacity
          onPress={resetRulesToDefault}
          style={[
            styles.resetBtn,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
            },
          ]}
        >
          <RotateCcw size={14} color={colors.textSecondary} />
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            Reset
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Live Simulator Card (See how rules execute on real money) */}
        <View
          style={[
            styles.simulatorCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.xl,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Zap size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                Live Allocation Simulator
              </Text>
            </View>
            <View
              style={[
                styles.simulatorBadge,
                {
                  backgroundColor: simulation.isEarmarked
                    ? colors.statusWarningLight
                    : colors.statusSuccessLight,
                  borderRadius: radii.full,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                },
              ]}
            >
              <Text
                style={{
                  color: simulation.isEarmarked ? colors.statusWarning : colors.statusSuccess,
                  fontSize: 10,
                  fontFamily: typography.fonts.semiBold,
                }}
              >
                {simulation.isEarmarked ? 'EARMARKED PASS-THROUGH' : 'SPLIT ACTIVE'}
              </Text>
            </View>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.sizes.xs,
              fontFamily: typography.fonts.regular,
              marginBottom: spacing.md,
            }}
          >
            Test how an incoming payment of any size splits through your financial rules:
          </Text>

          {/* Amount & Scenario Row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <CurrencyInput
                label="Simulated Inflow"
                value={testAmountStr}
                onChangeText={setTestAmountStr}
                placeholder="100,000.00"
              />
            </View>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View
                style={[
                  styles.quickPresetsRow,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.md,
                    padding: 4,
                    height: 48,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    setTestAmountStr('100,000.00');
                    setTestCategory('Employment');
                    setTestNotes('');
                  }}
                  style={[
                    styles.simPill,
                    testCategory === 'Employment' && !testNotes && { backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontFamily: typography.fonts.medium, color: colors.textPrimary }}>
                    ₦100k Salary
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setTestAmountStr('1,000,000.00');
                    setTestCategory('Gifts');
                    setTestNotes('Rent Support Gift');
                  }}
                  style={[
                    styles.simPill,
                    testNotes.includes('Rent') && { backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontFamily: typography.fonts.medium, color: colors.textPrimary }}>
                    ₦1M Rent Gift
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setTestAmountStr('500,000.00');
                    setTestCategory('Business');
                    setTestNotes('Freelance Project');
                  }}
                  style={[
                    styles.simPill,
                    testCategory === 'Business' && { backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontFamily: typography.fonts.medium, color: colors.textPrimary }}>
                    ₦500k Business
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Allocation Results Breakdown */}
          <View
            style={[
              styles.resultsBox,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.lg,
                padding: spacing.md,
              },
            ]}
          >
            {/* Top Deductions if any */}
            {(simulation.taxAmountMinor > 0n || simulation.titheAmountMinor > 0n) && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginBottom: spacing.sm,
                  paddingBottom: spacing.sm,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.borderSubtle,
                }}
              >
                {simulation.taxAmountMinor > 0n && (
                  <View style={styles.deductionPill}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Tax Provision ({taxRule.ratePercentage}%):{' '}
                      <Text style={{ color: colors.statusDanger, fontFamily: typography.fonts.semiBold }}>
                        {formatNaira(simulation.taxAmountMinor)}
                      </Text>
                    </Text>
                  </View>
                )}
                {simulation.titheAmountMinor > 0n && (
                  <View style={styles.deductionPill}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Tithe / Spiritual ({titheRule.ratePercentage}%):{' '}
                      <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold }}>
                        {formatNaira(simulation.titheAmountMinor)}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Pillar Breakdown Chips */}
            <View style={styles.simPillarsGrid}>
              {simulation.pillarAllocations.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.simPillarCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.md,
                      padding: spacing.sm,
                      borderLeftWidth: 3,
                      borderLeftColor: item.pillar.color,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: typography.fonts.medium,
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                    }}
                    numberOfLines={1}
                  >
                    {item.pillar.name} ({item.pillar.percentage}%)
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.sizes.bodySm,
                      fontFamily: typography.fonts.semiBold,
                      color: colors.textPrimary,
                      marginTop: 2,
                    }}
                  >
                    {formatNaira(item.allocatedMinor)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    → {item.pillar.purposeAccountType} account
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 2. Navigation Tabs */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.lg,
              padding: 4,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('framework')}
            style={[
              styles.tabBtn,
              activeTab === 'framework' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              },
              { borderRadius: radii.md },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'framework' ? colors.primary : colors.textSecondary,
                fontFamily:
                  activeTab === 'framework' ? typography.fonts.semiBold : typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Framework ({totalPercentage}%)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('tax_tithe')}
            style={[
              styles.tabBtn,
              activeTab === 'tax_tithe' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              },
              { borderRadius: radii.md },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'tax_tithe' ? colors.primary : colors.textSecondary,
                fontFamily:
                  activeTab === 'tax_tithe' ? typography.fonts.semiBold : typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Tax & Tithe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('earmarked')}
            style={[
              styles.tabBtn,
              activeTab === 'earmarked' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              },
              { borderRadius: radii.md },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'earmarked' ? colors.primary : colors.textSecondary,
                fontFamily:
                  activeTab === 'earmarked' ? typography.fonts.semiBold : typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Earmarked ({earmarkedRules.filter((r) => r.active).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('sub_allocation')}
            style={[
              styles.tabBtn,
              activeTab === 'sub_allocation' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              },
              { borderRadius: radii.md },
            ]}
          >
            <Text
              style={{
                color: activeTab === 'sub_allocation' ? colors.primary : colors.textSecondary,
                fontFamily:
                  activeTab === 'sub_allocation'
                    ? typography.fonts.semiBold
                    : typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              Sub-Allocations
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: ALLOCATION FRAMEWORK */}
        {activeTab === 'framework' && (
          <View>
            {/* Presets Row */}
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.textSecondary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.xs },
              ]}
            >
              POPULAR BLUEPRINT PRESETS
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {frameworkPresets.map((preset) => {
                const isSelected = activeFramework.id === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => applyPresetFramework(preset.id)}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.borderSubtle,
                        borderRadius: radii.lg,
                        padding: spacing.md,
                        marginRight: spacing.sm,
                        width: 220,
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
                        {preset.name}
                      </Text>
                      {isSelected && <Check size={14} color={colors.primary} />}
                    </View>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 11,
                        fontFamily: typography.fonts.regular,
                        marginTop: 4,
                      }}
                      numberOfLines={2}
                    >
                      {preset.tagline}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Total Balance Status Bar */}
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: isTotal100Percent ? colors.statusSuccessLight : colors.statusWarningLight,
                  borderColor: isTotal100Percent ? colors.statusSuccess : colors.statusWarning,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isTotal100Percent ? (
                  <Check size={18} color={colors.statusSuccess} style={{ marginRight: 6 }} />
                ) : (
                  <AlertTriangle size={18} color={colors.statusWarning} style={{ marginRight: 6 }} />
                )}
                <Text
                  style={{
                    color: isTotal100Percent ? colors.statusSuccess : colors.statusWarning,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {isTotal100Percent
                    ? '100% Balanced Allocation'
                    : `Total is currently ${totalPercentage}% (Must equal 100%)`}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: typography.fonts.semiBold,
                  color: isTotal100Percent ? colors.statusSuccess : colors.statusWarning,
                }}
              >
                {totalPercentage}%
              </Text>
            </View>

            {/* Pillar List */}
            {activeFramework.pillars.map((pillar) => (
              <View
                key={pillar.id}
                style={[
                  styles.pillarRowCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderLeftWidth: 4,
                    borderLeftColor: pillar.color,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: typography.fonts.semiBold,
                        fontSize: typography.sizes.bodySm,
                      }}
                    >
                      {pillar.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: typography.sizes.xs,
                        fontFamily: typography.fonts.regular,
                        marginTop: 2,
                      }}
                    >
                      {pillar.description}
                    </Text>
                    <View
                      style={[
                        styles.accountTag,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderRadius: radii.sm,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          alignSelf: 'flex-start',
                          marginTop: 6,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 10, color: colors.textSecondary, fontFamily: typography.fonts.medium }}>
                        Maps to: {pillar.purposeAccountType} account
                      </Text>
                    </View>
                  </View>

                  {/* Percentage Stepper */}
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      onPress={() => updatePillarPercentage(pillar.id, pillar.percentage - 5)}
                      style={[styles.stepBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm }]}
                    >
                      <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>
                        -
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.pctDisplay}>
                      <Text
                        style={{
                          fontSize: typography.sizes.lg,
                          fontFamily: typography.fonts.semiBold,
                          color: colors.textPrimary,
                        }}
                      >
                        {pillar.percentage}%
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => updatePillarPercentage(pillar.id, pillar.percentage + 5)}
                      style={[styles.stepBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm }]}
                    >
                      <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 2: TAX & TITHE RULES */}
        {activeTab === 'tax_tithe' && (
          <View>
            {/* Tithe Rule Card */}
            <View
              style={[
                styles.configCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.lg,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                    Tithe & Spiritual Giving (Off-The-Top)
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 }}>
                    Automatically sets aside religious tithes before distributing to living expenses
                  </Text>
                </View>
                <Switch
                  value={titheRule.enabled}
                  onValueChange={(val) => updateTitheRule({ enabled: val })}
                  trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                />
              </View>

              {titheRule.enabled && (
                <View style={{ paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>
                      Tithe Percentage:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[10, 15, 20].map((rate) => (
                        <TouchableOpacity
                          key={rate}
                          onPress={() => updateTitheRule({ ratePercentage: rate })}
                          style={[
                            styles.ratePill,
                            {
                              backgroundColor: titheRule.ratePercentage === rate ? colors.primaryLight : colors.surfaceSubtle,
                              borderColor: titheRule.ratePercentage === rate ? colors.primary : colors.borderSubtle,
                              borderRadius: radii.full,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: titheRule.ratePercentage === rate ? colors.primary : colors.textPrimary,
                              fontFamily: typography.fonts.medium,
                            }}
                          >
                            {rate}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>
                      Calculation Base:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => updateTitheRule({ base: 'gross' })}
                        style={[
                          styles.ratePill,
                          {
                            backgroundColor: titheRule.base === 'gross' ? colors.primaryLight : colors.surfaceSubtle,
                            borderColor: titheRule.base === 'gross' ? colors.primary : colors.borderSubtle,
                            borderRadius: radii.full,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: titheRule.base === 'gross' ? colors.primary : colors.textPrimary }}>
                          Gross Income
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateTitheRule({ base: 'net_after_tax' })}
                        style={[
                          styles.ratePill,
                          {
                            backgroundColor: titheRule.base === 'net_after_tax' ? colors.primaryLight : colors.surfaceSubtle,
                            borderColor: titheRule.base === 'net_after_tax' ? colors.primary : colors.borderSubtle,
                            borderRadius: radii.full,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: titheRule.base === 'net_after_tax' ? colors.primary : colors.textPrimary }}>
                          Net After Tax
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Tax Provision Card */}
            <View
              style={[
                styles.configCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.lg,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                    Tax Withholding / Self-Employed Provision
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 }}>
                    Withhold tax provision from business & freelance income before splitting
                  </Text>
                </View>
                <Switch
                  value={taxRule.enabled}
                  onValueChange={(val) => updateTaxRule({ enabled: val })}
                  trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                />
              </View>

              {taxRule.enabled && (
                <View style={{ paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>
                      Tax Provision Rate:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[5, 10, 15, 20].map((rate) => (
                        <TouchableOpacity
                          key={rate}
                          onPress={() => updateTaxRule({ ratePercentage: rate })}
                          style={[
                            styles.ratePill,
                            {
                              backgroundColor: taxRule.ratePercentage === rate ? colors.primaryLight : colors.surfaceSubtle,
                              borderColor: taxRule.ratePercentage === rate ? colors.primary : colors.borderSubtle,
                              borderRadius: radii.full,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: taxRule.ratePercentage === rate ? colors.primary : colors.textPrimary,
                              fontFamily: typography.fonts.medium,
                            }}
                          >
                            {rate}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginBottom: 6 }}>
                    Exempt Sources (Tax is NOT deducted from these):
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {['Employment (PAYE already deducted)', 'Gifts & Support', 'Government Grants'].map((source, i) => (
                      <View
                        key={i}
                        style={[
                          styles.exemptTag,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.borderSubtle,
                            borderRadius: radii.full,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                          },
                        ]}
                      >
                        <Check size={11} color={colors.statusSuccess} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, color: colors.textPrimary }}>{source}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB 3: EARMARKED INFLOWS */}
        {activeTab === 'earmarked' && (
          <View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}
            >
              <View>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                  Earmarked Inflows (100% Pass-Through)
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 2 }}>
                  When funds are meant for a specific bill or goal, bypass all splits and route 100% directly.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddEarmarkVisible(true)}
                style={[
                  styles.addEarmarkBtn,
                  { backgroundColor: colors.primary, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
                ]}
              >
                <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: typography.fonts.semiBold }}>
                  New Rule
                </Text>
              </TouchableOpacity>
            </View>

            {earmarkedRules.map((rule) => (
              <View
                key={rule.id}
                style={[
                  styles.earmarkCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Tag size={14} color={colors.primary} style={{ marginRight: 6 }} />
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                        {rule.name}
                      </Text>
                      <View
                        style={[
                          styles.passThroughBadge,
                          { backgroundColor: colors.primaryLight, borderRadius: radii.full, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 1 },
                        ]}
                      >
                        <Text style={{ color: colors.primary, fontSize: 10, fontFamily: typography.fonts.semiBold }}>
                          100% Direct
                        </Text>
                      </View>
                    </View>

                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginTop: 4 }}>
                      When {rule.triggerType === 'keyword' ? 'note contains' : 'source is'}:{' '}
                      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>
                        "{rule.triggerValue}"
                      </Text>{' '}
                      → routes directly to{' '}
                      <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold }}>
                        {rule.targetCategory} ({rule.targetAccountType} account)
                      </Text>
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Switch
                      value={rule.active}
                      onValueChange={() => toggleEarmarkedRule(rule.id)}
                      trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                    />
                    <TouchableOpacity onPress={() => deleteEarmarkedRule(rule.id)} style={{ padding: 4 }}>
                      <Trash2 size={16} color={colors.statusDanger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 4: SUB-ALLOCATION */}
        {activeTab === 'sub_allocation' && (
          <View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: spacing.md,
              }}
            >
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {selectedPillar.name} Sub-Allocation ({selectedPillar.percentage}% Pillar)
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    marginTop: 2,
                  }}
                >
                  Target budget envelope ratios across your major categories and subcategories enabled in Settings.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/settings')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radii.full,
                  backgroundColor: colors.surfaceSubtle,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Settings size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, color: colors.primary, fontFamily: typography.fonts.medium }}>
                  Settings
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pillar Selector Pills */}
            {activeFramework.pillars.length > 1 && (
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.md, flexWrap: 'wrap' }}>
                {activeFramework.pillars.map((pillar) => {
                  const isSelected = selectedPillar.id === pillar.id;
                  return (
                    <TouchableOpacity
                      key={pillar.id}
                      onPress={() => setSelectedPillarId(pillar.id)}
                      style={[
                        styles.pillarSelectPill,
                        {
                          backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.borderSubtle,
                          borderRadius: radii.full,
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: isSelected ? colors.primary : colors.textSecondary,
                          fontFamily: isSelected
                            ? typography.fonts.semiBold
                            : typography.fonts.medium,
                        }}
                      >
                        {pillar.name} ({pillar.percentage}%)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Total Balance Status Card */}
            <View
              style={{
                backgroundColor: isPillarSubBalanced ? colors.primaryLight : '#FEF3C7',
                borderColor: isPillarSubBalanced ? colors.primary : '#F59E0B',
                borderWidth: 1,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isPillarSubBalanced ? (
                    <CheckCircle2 size={15} color={colors.primary} style={{ marginRight: 6 }} />
                  ) : (
                    <AlertTriangle size={15} color="#D97706" style={{ marginRight: 6 }} />
                  )}
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: typography.fonts.semiBold,
                      color: isPillarSubBalanced ? colors.primary : '#B45309',
                    }}
                  >
                    {isPillarSubBalanced
                      ? 'Ratios Balanced at 100%'
                      : `Total is ${totalPillarAllocated}% (${100 - totalPillarAllocated > 0 ? `${100 - totalPillarAllocated}% unallocated` : `${totalPillarAllocated - 100}% over`})`}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: isPillarSubBalanced ? colors.textSecondary : '#92400E',
                    marginTop: 2,
                  }}
                >
                  {targetCategories.length} major active categories from your Settings are allocated below.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => autoBalanceCategories(targetCategories.map((c) => c.name))}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: isPillarSubBalanced ? colors.primary : '#D97706',
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radii.full,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: typography.fonts.semiBold,
                    color: isPillarSubBalanced ? colors.primary : '#B45309',
                  }}
                >
                  Auto-Balance
                </Text>
              </TouchableOpacity>
            </View>

            {/* Target Major Categories from Settings */}
            {targetCategories.map((cat) => {
              const catPct = getCategoryPercentage(cat.name, 0);
              const activeSubs = enabledSubcategories[cat.id] ?? cat.subcategories;
              const isExpanded = expandedCategoryId === cat.id;
              const incomeEquivalent = ((selectedPillar.percentage * catPct) / 100).toFixed(1);

              return (
                <View
                  key={cat.id}
                  style={[
                    styles.subAllocCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: typography.fonts.semiBold,
                          fontSize: typography.sizes.bodySm,
                        }}
                      >
                        {cat.name}
                      </Text>

                      <TouchableOpacity
                        onPress={() =>
                          setExpandedCategoryId(isExpanded ? null : cat.id)
                        }
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginTop: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 11,
                            fontFamily: typography.fonts.medium,
                          }}
                        >
                          {activeSubs.length} active subcategories
                        </Text>
                        {isExpanded ? (
                          <ChevronUp size={13} color={colors.primary} style={{ marginLeft: 3 }} />
                        ) : (
                          <ChevronDown size={13} color={colors.primary} style={{ marginLeft: 3 }} />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Stepper Controls */}
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => setCategorySubAllocation(cat.name, Math.max(0, catPct - 5))}
                          style={[
                            styles.stepBtn,
                            {
                              backgroundColor: colors.surfaceSubtle,
                              borderRadius: radii.sm,
                            },
                          ]}
                        >
                          <Minus size={13} color={colors.textPrimary} />
                        </TouchableOpacity>

                        <View
                          style={[
                            styles.subPctBadge,
                            {
                              backgroundColor: colors.primaryLight,
                              borderRadius: radii.full,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              minWidth: 80,
                              alignItems: 'center',
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: colors.primary,
                              fontFamily: typography.fonts.semiBold,
                              fontSize: 12,
                            }}
                          >
                            {catPct}%
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => setCategorySubAllocation(cat.name, Math.min(100, catPct + 5))}
                          style={[
                            styles.stepBtn,
                            {
                              backgroundColor: colors.surfaceSubtle,
                              borderRadius: radii.sm,
                            },
                          ]}
                        >
                          <Plus size={13} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </View>

                      <Text
                        style={{
                          color: colors.textTertiary,
                          fontSize: 10,
                          marginTop: 3,
                        }}
                      >
                        {incomeEquivalent}% of total income
                      </Text>
                    </View>
                  </View>

                  {/* Expandable Subcategories Drawer */}
                  {isExpanded && (
                    <View
                      style={{
                        marginTop: spacing.md,
                        paddingTop: spacing.md,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.borderSubtle,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: spacing.xs,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: typography.fonts.semiBold,
                            color: colors.textSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Subcategories (Enabled in Settings):
                        </Text>
                        <TouchableOpacity
                          onPress={() => router.push('/settings')}
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.primary,
                              fontFamily: typography.fonts.medium,
                            }}
                          >
                            Edit in Settings →
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {activeSubs.length === 0 ? (
                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic', marginVertical: 4 }}>
                          No subcategories enabled in Settings. All expenses under this category share the main envelope.
                        </Text>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {activeSubs.map((sub, sIdx) => (
                            <View
                              key={sIdx}
                              style={{
                                backgroundColor: colors.surfaceSubtle,
                                borderColor: colors.borderSubtle,
                                borderWidth: StyleSheet.hairlineWidth,
                                borderRadius: radii.full,
                                paddingHorizontal: 9,
                                paddingVertical: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <Check size={10} color={colors.primary} style={{ marginRight: 4 }} />
                              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                {sub}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sheet to Add Earmarked Inflow Rule */}
      <AddEarmarkedRuleSheet
        visible={addEarmarkVisible}
        onClose={() => setAddEarmarkVisible(false)}
        onSaveRule={addEarmarkedRule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {},
  screenTitle: {},
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingBottom: 60,
  },
  simulatorCard: {
    borderWidth: 1,
  },
  simulatorBadge: {},
  quickPresetsRow: {},
  simPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resultsBox: {},
  deductionPill: {},
  simPillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  simPillarCard: {
    flex: 1,
    minWidth: 140,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetCard: {
    borderWidth: 1,
  },
  statusBanner: {
    borderWidth: 1,
  },
  pillarRowCard: {
    borderWidth: 1,
  },
  accountTag: {},
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctDisplay: {
    width: 48,
    alignItems: 'center',
  },
  configCard: {
    borderWidth: 1,
  },
  ratePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  exemptTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  addEarmarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earmarkCard: {
    borderWidth: 1,
  },
  passThroughBadge: {},
  subAllocCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  subPctBadge: {},
  pillarSelectPill: {},
});
