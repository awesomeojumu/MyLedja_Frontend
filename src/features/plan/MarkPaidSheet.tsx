import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Building2, Check } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import { formatNaira } from '../../money';

interface MarkPaidSheetProps {
  visible: boolean;
  onClose: () => void;
  billName: string;
  amountMinor: bigint;
  onConfirmPaid: (account: string) => void;
}

export function MarkPaidSheet({
  visible,
  onClose,
  billName,
  amountMinor,
  onConfirmPaid,
}: MarkPaidSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const accounts = ['GTBank Main Salary', 'Kuda Bank', 'Cash Wallet'];
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]!);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Confirm Bill Payment">
      <View style={styles.container}>
        <View
          style={[
            styles.billCard,
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
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Marking Paid
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.body,
              marginTop: 2,
            }}
          >
            {billName}
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.lg,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(amountMinor)}
          </Text>
        </View>

        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.medium,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.xs,
          }}
        >
          Paid From Account
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
            label="Confirm & Mark Paid"
            onPress={() => {
              onConfirmPaid(selectedAccount);
              onClose();
            }}
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
  billCard: {
    borderWidth: 1,
  },
  accRow: {
    borderWidth: 1,
  },
});
