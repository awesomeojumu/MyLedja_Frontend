import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { parseAmount } from '../../money';

interface CustomCategoryPopupProps {
  visible: boolean;
  onClose: () => void;
  onAddCategory: (category: { name: string; targetMinor: bigint }) => void;
}

export function CustomCategoryPopup({
  visible,
  onClose,
  onAddCategory,
}: CustomCategoryPopupProps) {
  const { spacing } = useTheme();
  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please enter a category name');
      return;
    }
    const parsed = parseAmount(targetText);
    const targetMinor = parsed.ok ? parsed.minor : 0n;

    onAddCategory({
      name: name.trim(),
      targetMinor,
    });
    setName('');
    setTargetText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setError('');
        onClose();
      }}
      title="Add Custom Category Envelope"
    >
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Category Name"
            placeholder="e.g. Gym Membership, Childcare..."
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            error={error}
            autoFocus
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput
            label="Monthly Target (Optional)"
            value={targetText}
            onChangeText={setTargetText}
          />
        </View>

        <Button
          label="Add Category"
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
});
