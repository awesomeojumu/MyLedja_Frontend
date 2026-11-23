import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, Dropdown, Button } from '../../design';
import { EarmarkedRule } from '../../data/rulesModel';
import { EXPENSE_TAXONOMY } from '../../data/categoriesTaxonomy';

import { t } from '../../i18n';
export interface AddEarmarkedRuleSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaveRule: (rule: Omit<EarmarkedRule, 'id'>) => void;
}

const TRIGGER_TYPE_OPTIONS = [
  { label: 'Keyword in Note / Description', value: 'keyword', subtitle: 'e.g. When note contains "Rent"' },
  { label: 'Income Category', value: 'income_category', subtitle: 'e.g. When income source is "Gifts"' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { label: 'Bills Account (Recurring & Obligations)', value: 'bills' },
  { label: 'Operating Account (Daily Living & Food)', value: 'operating' },
  { label: 'Emergency Fund Account (Safety Cushion)', value: 'emergency' },
  { label: 'Savings Account (Short-term Targets)', value: 'savings' },
  { label: 'Investment Account (Wealth Creation)', value: 'investment' },
  { label: 'Project Account (Major Goals & Capital)', value: 'project' },
];

const CATEGORY_OPTIONS = EXPENSE_TAXONOMY.map((c) => ({
  label: c.name,
  value: c.name,
  subtitle: c.description,
}));

export function AddEarmarkedRuleSheet({
  visible,
  onClose,
  onSaveRule,
}: AddEarmarkedRuleSheetProps) {
  const { spacing } = useTheme();

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'keyword' | 'income_category'>('keyword');
  const [triggerValue, setTriggerValue] = useState('');
  const [targetCategory, setTargetCategory] = useState('Housing');
  const [targetAccountType, setTargetAccountType] = useState<EarmarkedRule['targetAccountType']>('bills');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please enter a rule name');
      return;
    }
    if (!triggerValue.trim()) {
      setError('Please specify the trigger keyword or income source');
      return;
    }
    setError('');

    onSaveRule({
      name: name.trim(),
      triggerType,
      triggerValue: triggerValue.trim(),
      targetCategory,
      targetAccountType,
      passThroughPercentage: 100,
      active: true,
    });

    // Reset
    setName('');
    setTriggerValue('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('ui.addEarmarkedRuleSheet.newEarmarkedInflowRule')}
      subtitle="Bypass percentage splits and allocate 100% directly to a target purpose"
    >
      <View style={styles.form}>
        {/* Rule Name */}
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={t('ui.addEarmarkedRuleSheet.ruleName')}
            placeholder={t('ui.addEarmarkedRuleSheet.eGRentSupportGift')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        {/* Trigger Type */}
        <View style={{ marginBottom: spacing.md }}>
          <Dropdown
            label={t('ui.addEarmarkedRuleSheet.whenToTrigger')}
            value={triggerType}
            options={TRIGGER_TYPE_OPTIONS}
            onSelect={(val) => setTriggerType(val as any)}
          />
        </View>

        {/* Trigger Value */}
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={
              triggerType === 'keyword'
                ? 'Keyword To Detect (e.g. Rent, School Fees, Car)'
                : 'Income Category Name (e.g. Gifts, Business, Grants)'
            }
            placeholder={triggerType === 'keyword' ? 'e.g. Rent' : 'e.g. Gifts'}
            value={triggerValue}
            onChangeText={setTriggerValue}
          />
        </View>

        {/* Target Category */}
        <View style={{ marginBottom: spacing.md }}>
          <Dropdown
            label={t('ui.addEarmarkedRuleSheet.targetExpenseCategory100Pass')}
            value={targetCategory}
            options={CATEGORY_OPTIONS}
            onSelect={setTargetCategory}
          />
        </View>

        {/* Target Purposeful Account */}
        <View style={{ marginBottom: spacing.lg }}>
          <Dropdown
            label={t('ui.addEarmarkedRuleSheet.targetAccountPurpose')}
            value={targetAccountType}
            options={ACCOUNT_TYPE_OPTIONS}
            onSelect={(val) => setTargetAccountType(val as any)}
          />
        </View>

        {/* Submit */}
        <Button
          label={t('ui.addEarmarkedRuleSheet.createEarmarkedRule')}
          onPress={handleSave}
          variant="primary"
          size="lg"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
