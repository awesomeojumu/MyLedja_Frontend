import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput as RNTextInput,
} from 'react-native';
import {
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';
import { CategoryDefinition } from '../../data/categoriesTaxonomy';

import { t } from '../../i18n';
interface CategoryPreferencesSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CategoryPreferencesSheet({ visible, onClose }: CategoryPreferencesSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const {
    allExpenseCategories,
    allIncomeCategories,
    enabledExpenseIds,
    enabledIncomeIds,
    enabledSubcategories,
    toggleExpenseCategory,
    toggleIncomeCategory,
    toggleSubcategory,
    selectAllSubcategories,
    deselectAllSubcategories,
    isSubcategoryEnabled,
    resetToDefaults,
  } = useCategoryPreferences();

  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const categories = activeTab === 'income' ? allIncomeCategories : allExpenseCategories;
  const enabledIds = activeTab === 'income' ? enabledIncomeIds : enabledExpenseIds;
  const toggleCategory = activeTab === 'income' ? toggleIncomeCategory : toggleExpenseCategory;

  const filteredCategories = categories.filter((cat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cat.name.toLowerCase().includes(q) ||
      cat.description.toLowerCase().includes(q) ||
      cat.subcategories.some((sub) => sub.toLowerCase().includes(q))
    );
  });

  const toggleExpand = (id: string) => {
    setExpandedCategoryId((prev) => (prev === id ? null : id));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('ui.categoryPreferencesSheet.customizeCategories')}
      subtitle="Choose which categories appear in your entry dropdowns"
    >
      <View style={styles.container}>
        {/* Tab Switcher: Income vs Expense */}
        <View
          style={[
            styles.tabContainer,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.md,
              padding: 4,
              marginBottom: spacing.md,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              setActiveTab('income');
              setSearchQuery('');
            }}
            style={[
              styles.tabBtn,
              activeTab === 'income' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              },
              { borderRadius: radii.sm },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'income' ? colors.primary : colors.textSecondary,
                  fontFamily:
                    activeTab === 'income' ? typography.fonts.semiBold : typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                },
              ]}
            >
              {t('ui.categoryPreferencesSheet.income')}{enabledIncomeIds.length}/{allIncomeCategories.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setActiveTab('expense');
              setSearchQuery('');
            }}
            style={[
              styles.tabBtn,
              activeTab === 'expense' && {
                backgroundColor: colors.surface,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              },
              { borderRadius: radii.sm },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'expense' ? colors.primary : colors.textSecondary,
                  fontFamily:
                    activeTab === 'expense' ? typography.fonts.semiBold : typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                },
              ]}
            >
              {t('ui.categoryPreferencesSheet.expense')}{enabledExpenseIds.length}/{allExpenseCategories.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar & Reset */}
        <View style={[styles.filterBar, { marginBottom: spacing.md }]}>
          <View
            style={[
              styles.searchWrap,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            <Search size={16} color={colors.textTertiary} />
            <RNTextInput
              style={[
                styles.searchInput,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.bodySm,
                },
              ]}
              placeholder={`Search ${activeTab === 'income' ? 'income' : 'expense'}...`}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            onPress={resetToDefaults}
            style={[
              styles.resetBtn,
              {
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                paddingHorizontal: spacing.sm,
              },
            ]}
          >
            <RotateCcw size={14} color={colors.textSecondary} />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontFamily: typography.fonts.medium,
                marginLeft: 4,
              }}
            >
              {t('ui.categoryPreferencesSheet.reset')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Categories List */}
        <ScrollView
          style={{ maxHeight: 420 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.md }}
        >
          {filteredCategories.map((cat: CategoryDefinition) => {
            const isEnabled = enabledIds.includes(cat.id);
            const isExpanded = expandedCategoryId === cat.id;
            const currentActiveSubs = enabledSubcategories[cat.id] ?? cat.subcategories;
            const activeSubCount = currentActiveSubs.length;
            const totalSubCount = cat.subcategories.length;

            return (
              <View
                key={cat.id}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: isEnabled ? colors.surface : colors.surfaceSubtle,
                    borderColor: isEnabled ? colors.borderSubtle : colors.borderSubtle,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    marginBottom: spacing.xs,
                    opacity: isEnabled ? 1 : 0.7,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.catName,
                          {
                            color: colors.textPrimary,
                            fontFamily: typography.fonts.semiBold,
                            fontSize: typography.sizes.bodySm,
                          },
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {isEnabled && (
                        <View
                          style={[
                            styles.activeBadge,
                            { backgroundColor: colors.statusSuccessLight },
                          ]}
                        >
                          <Text
                            style={{
                              color: colors.statusSuccess,
                              fontSize: 10,
                              fontFamily: typography.fonts.semiBold,
                            }}
                          >
                            {t('ui.categoryPreferencesSheet.active')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.catDesc,
                        {
                          color: colors.textSecondary,
                          fontFamily: typography.fonts.regular,
                          fontSize: typography.sizes.xs,
                          marginTop: 2,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.description}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm }}>
                    <TouchableOpacity
                      onPress={() => toggleExpand(cat.id)}
                      style={[
                        styles.expandBtn,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderRadius: radii.sm,
                          marginRight: spacing.sm,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: activeSubCount > 0 ? colors.primary : colors.textTertiary,
                          fontSize: 11,
                          fontFamily: typography.fonts.medium,
                          marginRight: 2,
                        }}
                      >
                        {activeSubCount}/{totalSubCount}{' '}{t('ui.categoryPreferencesSheet.subs')}
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={14} color={colors.textTertiary} />
                      ) : (
                        <ChevronDown size={14} color={colors.textTertiary} />
                      )}
                    </TouchableOpacity>

                    <Switch
                      value={isEnabled}
                      onValueChange={() => toggleCategory(cat.id)}
                      trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                    />
                  </View>
                </View>

                {/* Subcategories drawer if expanded */}
                {isExpanded && (
                  <View
                    style={[
                      styles.subcategoriesBox,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderRadius: radii.sm,
                        padding: spacing.sm,
                        marginTop: spacing.sm,
                      },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 11,
                          fontFamily: typography.fonts.semiBold,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t('ui.categoryPreferencesSheet.selectSubcategories')}{activeSubCount}/{totalSubCount}):
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => selectAllSubcategories(cat.id)}
                          style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                        >
                          <Text
                            style={{
                              color: colors.primary,
                              fontSize: 11,
                              fontFamily: typography.fonts.semiBold,
                            }}
                          >
                            {t('ui.categoryPreferencesSheet.selectAll')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deselectAllSubcategories(cat.id)}
                          style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                        >
                          <Text
                            style={{
                              color: colors.textTertiary,
                              fontSize: 11,
                              fontFamily: typography.fonts.medium,
                            }}
                          >
                            {t('ui.categoryPreferencesSheet.clearAll')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.subChipsGrid}>
                      {cat.subcategories.map((sub, i) => {
                        const isSubActive = isSubcategoryEnabled(cat.id, sub);
                        return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => toggleSubcategory(cat.id, sub)}
                            style={[
                              styles.subChip,
                              {
                                backgroundColor: isSubActive ? colors.primaryLight : colors.surface,
                                borderColor: isSubActive ? colors.primary : colors.borderSubtle,
                                borderRadius: radii.full,
                                flexDirection: 'row',
                                alignItems: 'center',
                              },
                            ]}
                          >
                            {isSubActive && (
                              <Check size={11} color={colors.primary} style={{ marginRight: 4 }} />
                            )}
                            <Text
                              style={{
                                color: isSubActive ? colors.primary : colors.textSecondary,
                                fontSize: 11,
                                fontFamily: isSubActive
                                  ? typography.fonts.semiBold
                                  : typography.fonts.regular,
                              }}
                            >
                              {sub}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={{ marginTop: spacing.md }}>
          <Button label={t('ui.categoryPreferencesSheet.doneCustomizing')} onPress={onClose} variant="primary" size="lg" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  tabContainer: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {},
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    height: '100%',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catName: {},
  catDesc: {},
  activeBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  subcategoriesBox: {},
  subChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
