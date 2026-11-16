import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

export interface PayeeItem {
  id: string;
  name: string;
  defaultCategory?: string;
  matchPattern?: string;
  txCount: number;
}

interface EditPayeeSheetProps {
  visible: boolean;
  onClose: () => void;
  payee: PayeeItem;
  onSave: (updated: { name: string; defaultCategory: string; matchPattern?: string }) => void;
  onMergeRequest?: () => void;
}

export function EditPayeeSheet({
  visible,
  onClose,
  payee,
  onSave,
  onMergeRequest,
}: EditPayeeSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [name, setName] = useState(payee.name);
  const [category, setCategory] = useState(payee.defaultCategory || 'Groceries');
  const [matchPattern, setMatchPattern] = useState(payee.matchPattern || '');
  const [error, setError] = useState('');

  const categories = ['Groceries', 'Transport & Fuel', 'Utilities', 'Dining', 'Shopping', 'Entertainment'];

  const handleSave = () => {
    if (!name.trim()) {
      setError('Payee name cannot be empty');
      return;
    }
    onSave({
      name: name.trim(),
      defaultCategory: category,
      matchPattern: matchPattern.trim(),
    });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Edit Payee & Rules">
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Payee / Merchant Display Name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              marginBottom: spacing.xs,
            }}
          >
            Default Auto-Assigned Category
          </Text>
          <View style={styles.catGrid}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: category === c ? colors.primaryLight : colors.surfaceSubtle,
                    borderColor: category === c ? colors.primary : colors.borderSubtle,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 6,
                  },
                ]}
              >
                <Text
                  style={{
                    color: category === c ? colors.primary : colors.textSecondary,
                    fontSize: 12,
                    fontFamily: typography.fonts.medium,
                  }}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label="Bank Statement Match String (Optional)"
            placeholder="e.g. SHOPRITE LEKKI or UBER *TRIP"
            value={matchPattern}
            onChangeText={setMatchPattern}
          />
        </View>

        <Button
          label="Save Payee Settings"
          onPress={handleSave}
          variant="primary"
          size="lg"
        />

        {onMergeRequest && (
          <TouchableOpacity
            onPress={() => {
              onMergeRequest();
              onClose();
            }}
            style={[
              styles.mergeBtn,
              {
                marginTop: spacing.md,
                padding: spacing.sm,
              },
            ]}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Merge with Another Payee
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    borderWidth: 1,
  },
  mergeBtn: {},
});
