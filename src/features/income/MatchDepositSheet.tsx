import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, ArrowDownLeft } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import { formatNaira } from '../../money';

interface MatchDepositSheetProps {
  visible: boolean;
  onClose: () => void;
  streamName: string;
  expectedMinor: bigint;
  onLinkTransaction: (txId: string) => void;
}

export function MatchDepositSheet({
  visible,
  onClose,
  streamName,
  expectedMinor,
  onLinkTransaction,
}: MatchDepositSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // Unlinked deposit transactions from bank accounts
  const unlinkedDeposits = [
    {
      id: 'dep-1',
      date: 'Today',
      narration: 'PAYSTACK/NIBSS TRF SALARY OCT',
      account: 'GTBank Salary',
      amountMinor: 85000000n,
    },
    {
      id: 'dep-2',
      date: '10 Nov',
      narration: 'INTER-BANK TRF DIRECT INFLOW',
      account: 'Kuda Bank',
      amountMinor: 15000000n,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Match Deposit for ${streamName}`}>
      <View style={styles.container}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.bodySm,
            marginBottom: spacing.md,
          }}
        >
          Select an incoming deposit to mark this stream as received for the month.
        </Text>

        {unlinkedDeposits.map((dep) => (
          <TouchableOpacity
            key={dep.id}
            onPress={() => setSelectedTxId(dep.id)}
            style={[
              styles.depRow,
              {
                backgroundColor:
                  selectedTxId === dep.id ? colors.primaryLight : colors.surfaceSubtle,
                borderColor: selectedTxId === dep.id ? colors.primary : colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <ArrowDownLeft size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {dep.narration}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {dep.date} • {dep.account}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.statusSuccess,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                +{formatNaira(dep.amountMinor)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Link Deposit to Stream"
            onPress={() => {
              if (selectedTxId) {
                onLinkTransaction(selectedTxId);
              }
              onClose();
            }}
            variant="primary"
            size="lg"
            disabled={!selectedTxId}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  depRow: {
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
