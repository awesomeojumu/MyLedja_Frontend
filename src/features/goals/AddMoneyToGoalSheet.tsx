import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Building2, Check } from 'lucide-react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { parseAmount, formatNaira } from '../../money';

interface AddMoneyToGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  goalName: string;
  targetMinor: bigint;
  currentMinor: bigint;
  onTransfer: (amountMinor: bigint, fromAccount: string) => void;
}

export function AddMoneyToGoalSheet({
  visible,
  onClose,
  goalName,
  targetMinor,
  currentMinor,
  onTransfer,
}: AddMoneyToGoalSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const accounts = ['GTBank Main Salary', 'Kuda Bank', 'PiggyVest Vault'];
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]!);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState('');

  const remainingToGoal = targetMinor - currentMinor;

  const handleSave = () => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError('Please enter a valid amount');
      return;
    }
    onTransfer(parsed.minor, selectedAccount);
    setAmountText('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Transfer to ${goalName}`}>
      <View style={styles.container}>
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.sizes.xs,
              fontFamily: typography.fonts.regular,
            }}
          >
            Target Remainder
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.md,
              marginTop: 2,
            }}
          >
            {formatNaira(remainingToGoal > 0n ? remainingToGoal : 0n)} left to complete goal
          </Text>
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <CurrencyInput
            label="Deposit Amount"
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              if (error) setError('');
            }}
            error={error}
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
          Transfer From
        </Text>

        {accounts.map((acc) => (
          <TouchableOpacity
            key={acc}
            onPress={() => setSelectedAccount(acc)}
            style={[
              styles.accRow,
              {
                backgroundColor:
                  selectedAccount === acc ? colors.primaryLight : colors.surfaceSubtle,
                borderColor: selectedAccount === acc ? colors.primary : colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.xs,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Building2 size={16} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                  marginLeft: spacing.sm,
                }}
              >
                {acc}
              </Text>
            </View>
            {selectedAccount === acc && <Check size={16} color={colors.primary} />}
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Transfer to Goal Vault"
            onPress={handleSave}
            variant="primary"
            size="lg"
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
  infoCard: {
    borderWidth: 1,
  },
  accRow: {
    borderWidth: 1,
  },
});
