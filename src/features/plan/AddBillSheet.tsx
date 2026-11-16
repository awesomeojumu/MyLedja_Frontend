import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button, Dropdown } from '../../design';
import { parseAmount } from '../../money';
import { useCategoryPreferences } from '../categories/CategoryPreferencesContext';

export interface AddedBill {
  id: string;
  name: string;
  amountMinor: bigint;
  dueDay: number;
  cadence: 'monthly' | 'quarterly' | 'annual';
  category: string;
  subcategory?: string;
}

interface AddBillSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (bill: AddedBill) => void;
}

export function AddBillSheet({
  visible,
  onClose,
  onSave,
}: AddBillSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { activeExpenseCategories, getSubcategoriesForExpense } = useCategoryPreferences();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [cadence, setCadence] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  const defaultCategory =
    activeExpenseCategories.find((c) => c.name.toLowerCase().includes('comm') || c.name.toLowerCase().includes('util'))?.name ||
    activeExpenseCategories[0]?.name ||
    'Utilities';

  const [category, setCategory] = useState(defaultCategory);
  const [subcategory, setSubcategory] = useState('');
  const [error, setError] = useState('');

  // Synchronize available subcategories whenever category changes
  const availableSubcategories = getSubcategoriesForExpense(category);

  useEffect(() => {
    if (availableSubcategories.length > 0) {
      setSubcategory(availableSubcategories[0]!);
    } else {
      setSubcategory('');
    }
  }, [category]);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Bill name is required');
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }

    onSave({
      id: `bill-${Date.now()}`,
      name: name.trim(),
      amountMinor: parsed.minor,
      dueDay: parseInt(dueDay, 10) || 1,
      cadence,
      category: category.trim(),
      subcategory: subcategory.trim() || undefined,
    });
    setName('');
    setAmountText('');
    setError('');
    onClose();
  };

  const categoryOptions = activeExpenseCategories.map((c) => ({
    label: c.name,
    value: c.name,
  }));

  const subcategoryOptions = availableSubcategories.map((sub) => ({
    label: sub,
    value: sub,
  }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Recurring Bill & Plan">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {/* Bill Name */}
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput
            label="Bill or Subscription Name"
            placeholder="e.g. Apple Cloud, MTN Home Internet, Electricity"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        {/* Amount */}
        <View style={{ marginBottom: spacing.sm }}>
          <CurrencyInput
            label="Scheduled Amount"
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
          />
        </View>

        {/* Expense Category Dropdown */}
        <View style={{ marginBottom: spacing.sm }}>
          <Dropdown
            label="Expense Category"
            options={categoryOptions}
            value={category}
            onSelect={(val) => setCategory(val)}
          />
        </View>

        {/* Expense Subcategory Dropdown */}
        {subcategoryOptions.length > 0 && (
          <View style={{ marginBottom: spacing.sm }}>
            <Dropdown
              label="Target Subcategory"
              options={subcategoryOptions}
              value={subcategory}
              onSelect={(val) => setSubcategory(val)}
            />
          </View>
        )}

        {/* Due Day */}
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput
            label="Due Day of Month"
            value={dueDay}
            onChangeText={setDueDay}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>

        {/* Cadence Buttons */}
        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              marginBottom: 4,
            }}
          >
            Billing Frequency
          </Text>
          <View
            style={[
              styles.cadenceRow,
              {
                backgroundColor: colors.surfaceSubtle,
                borderRadius: radii.md,
                padding: 3,
              },
            ]}
          >
            {(['monthly', 'quarterly', 'annual'] as const).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCadence(c)}
                style={[
                  styles.cadenceBtn,
                  {
                    backgroundColor: cadence === c ? colors.surface : 'transparent',
                    borderRadius: radii.sm,
                    paddingVertical: 6,
                    flex: 1,
                    alignItems: 'center',
                  },
                ]}
              >
                <Text
                  style={{
                    color: cadence === c ? colors.primary : colors.textSecondary,
                    fontFamily: typography.fonts.medium,
                    fontSize: 11,
                    textTransform: 'capitalize',
                  }}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          label="Save Recurring Bill to Budget Plan"
          onPress={handleSave}
          variant="primary"
          size="md"
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  cadenceRow: {
    flexDirection: 'row',
  },
  cadenceBtn: {},
});
