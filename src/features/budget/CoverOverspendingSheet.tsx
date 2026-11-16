import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, Dropdown, Button } from '../../design';
import { formatNaira } from '../../money';
import type { CategoryEnvelope } from './CategoryEnvelopeRow';

export interface CoverOverspendingSheetProps {
  visible: boolean;
  onClose: () => void;
  overspentEnvelopes: CategoryEnvelope[];
  fundedEnvelopes: CategoryEnvelope[];
  onCover: (overspentId: string, sourceId: string, amountMinor: bigint) => void;
}

export function CoverOverspendingSheet({
  visible,
  onClose,
  overspentEnvelopes,
  fundedEnvelopes,
  onCover,
}: CoverOverspendingSheetProps) {
  const { spacing } = useTheme();

  const [selectedOverspent, setSelectedOverspent] = useState(overspentEnvelopes[0]?.id ?? '');
  const [selectedSource, setSelectedSource] = useState(fundedEnvelopes[0]?.id ?? '');

  const target = overspentEnvelopes.find((e) => e.id === selectedOverspent);
  const deficitMinor = target ? target.spentMinor - target.plannedMinor : 0n;

  const handleExecuteCover = () => {
    if (!selectedOverspent || !selectedSource || deficitMinor <= 0n) return;
    onCover(selectedOverspent, selectedSource, deficitMinor);
    onClose();
  };

  const overspentOptions = overspentEnvelopes.map((env) => ({
    label: env.name,
    value: env.id,
    subtitle: `Over by ${formatNaira(env.spentMinor - env.plannedMinor)}`,
  }));

  const fundedOptions = fundedEnvelopes.map((env) => ({
    label: env.name,
    value: env.id,
    subtitle: `${formatNaira(env.plannedMinor - env.spentMinor)} available`,
  }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Cover Overspending"
      subtitle="Rebalance overspent envelopes instantly"
    >
      <View style={styles.container}>
        {/* Step 1: Which envelope is overspent */}
        <Dropdown
          label="Overspent Envelope"
          value={selectedOverspent}
          options={overspentOptions}
          onSelect={setSelectedOverspent}
          containerStyle={{ marginBottom: spacing.md }}
        />

        {/* Step 2: Where to pull the money from */}
        <Dropdown
          label="Take Money From"
          value={selectedSource}
          options={fundedOptions}
          onSelect={setSelectedSource}
          containerStyle={{ marginBottom: spacing.xl }}
        />

        {/* Confirm Action Button */}
        <Button
          label={`Cover Deficit (${formatNaira(deficitMinor)})`}
          onPress={handleExecuteCover}
          variant="primary"
          size="lg"
          disabled={deficitMinor <= 0n || !selectedSource}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
