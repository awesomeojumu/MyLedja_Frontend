import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

export interface AddedRule {
  id: string;
  keyword: string;
  targetCategory: string;
  active: boolean;
}

interface NewRuleSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (rule: AddedRule) => void;
}

export function NewRuleSheet({
  visible,
  onClose,
  onSave,
}: NewRuleSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [keyword, setKeyword] = useState('');
  const [targetCategory, setTargetCategory] = useState('Transport & Fuel');
  const [error, setError] = useState('');

  const categories = [
    'Transport & Fuel',
    'Groceries',
    'Dining Out',
    'Utilities',
    'Subscriptions',
    'Shopping',
  ];

  const handleSave = () => {
    if (!keyword.trim()) {
      setError('Keyword or match pattern is required');
      return;
    }
    onSave({
      id: `rule-${Date.now()}`,
      keyword: keyword.trim(),
      targetCategory,
      active: true,
    });
    setKeyword('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Create Categorization Rule">
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="When transaction narration contains"
            placeholder="e.g. Bolt, Uber, Netflix, Total, Shoprite"
            value={keyword}
            onChangeText={(t) => {
              setKeyword(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.medium,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.xs,
          }}
        >
          Automatically assign category:
        </Text>

        <View style={[styles.catGrid, { marginBottom: spacing.lg }]}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setTargetCategory(c)}
              style={[
                styles.catChip,
                {
                  backgroundColor:
                    targetCategory === c ? colors.primaryLight : colors.surfaceSubtle,
                  borderColor: targetCategory === c ? colors.primary : colors.borderSubtle,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                },
              ]}
            >
              <Text
                style={{
                  color: targetCategory === c ? colors.primary : colors.textSecondary,
                  fontSize: 12,
                  fontFamily: typography.fonts.medium,
                }}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          label="Save & Apply Rule"
          onPress={handleSave}
          variant="primary"
          size="lg"
        />
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
});
