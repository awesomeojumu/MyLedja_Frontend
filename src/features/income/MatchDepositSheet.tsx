import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, ArrowDownLeft } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import { formatNaira } from '../../money';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

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
  const { events: dbEvents, accounts: dbAccounts } = useDatabaseData();

  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // Real unlinked deposit transactions from database
  const unlinkedDeposits = React.useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      narration: string;
      account: string;
      amountMinor: bigint;
    }> = [];

    for (const ev of dbEvents) {
      if (ev.type !== 'income' || ev.status !== 'posted') continue;
      let evAmount = 0n;
      let accName = 'Account';
      for (const line of ev.lines) {
        if (line.amountMinor > 0n) {
          evAmount += line.amountMinor;
          const foundAcc = dbAccounts.find((a) => a.id === line.ledgerAccountId);
          if (foundAcc) accName = foundAcc.name;
        }
      }
      list.push({
        id: ev.id,
        date: ev.date,
        narration: ev.notes || ev.payeeName || 'Direct Income Deposit',
        account: accName,
        amountMinor: evAmount,
      });
    }
    return list;
  }, [dbEvents, dbAccounts]);

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

        {unlinkedDeposits.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
              }}
            >
              No unlinked income deposits found in your ledger.
            </Text>
          </View>
        ) : (
          unlinkedDeposits.map((dep) => (
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
          ))
        )}

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
