import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { toInputText } from '../../money';
import type { CategoryEnvelope } from './CategoryEnvelopeRow';

export interface EditEnvelopeLimitSheetProps {
  visible: boolean;
  onClose: () => void;
  envelope: CategoryEnvelope | null;
  onSaveLimit: (id: string, newLimitMinor: bigint) => void;
}

export function EditEnvelopeLimitSheet({
  visible,
  onClose,
  envelope,
  onSaveLimit,
}: EditEnvelopeLimitSheetProps) {
  const { spacing } = useTheme();

  const [limitText, setLimitText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (envelope) {
      setLimitText(toInputText(envelope.plannedMinor));
    }
  }, [envelope]);

  if (!envelope) return null;

  const handleSave = () => {
    if (!limitText || parseFloat(limitText) < 0) {
      setError('Please enter a valid monthly target limit');
      return;
    }
    setError('');
    const minor = BigInt(Math.round(parseFloat(limitText) * 100));
    onSaveLimit(envelope.id, minor);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Edit ${envelope.name} Budget`}
      subtitle="Update planned monthly envelope limit"
    >
      <View style={styles.form}>
        <CurrencyInput
          value={limitText}
          onChangeText={(v) => {
            setLimitText(v);
            if (error) setError('');
          }}
          label="Monthly Planned Amount"
          error={error}
        />

        <View style={{ marginTop: spacing.xl }}>
          <Button label="Save Envelope Limit" onPress={handleSave} variant="primary" size="lg" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
