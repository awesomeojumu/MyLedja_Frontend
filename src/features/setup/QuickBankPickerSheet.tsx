import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Search, ArrowLeft } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, CurrencyInput, Button } from '../../design';
import { NG_INSTITUTIONS, type Institution } from './institutions';
import { parseAmount } from '../../money';

export interface AddedBankAccount {
  id: string;
  name: string;
  institutionId: string;
  institutionLabel: string;
  initials: string;
  balanceMinor: bigint;
}

interface QuickBankPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onAddAccount: (account: AddedBankAccount) => void;
}

export function QuickBankPickerSheet({
  visible,
  onClose,
  onAddAccount,
}: QuickBankPickerSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [search, setSearch] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [accountName, setAccountName] = useState('');
  const [balanceText, setBalanceText] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NG_INSTITUTIONS;
    return NG_INSTITUTIONS.filter(
      (inst) =>
        inst.label.toLowerCase().includes(q) ||
        inst.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  }, [search]);

  const handleSelectInstitution = (inst: Institution) => {
    setSelectedInstitution(inst);
    setAccountName(inst.label);
  };

  const handleConfirm = () => {
    if (!selectedInstitution) return;
    const parsed = parseAmount(balanceText);
    const balanceMinor = parsed.ok ? parsed.minor : 0n;

    onAddAccount({
      id: `acc-${Date.now()}`,
      name: accountName.trim() || selectedInstitution.label,
      institutionId: selectedInstitution.id,
      institutionLabel: selectedInstitution.label,
      initials: selectedInstitution.initials,
      balanceMinor,
    });
    // Reset
    setSelectedInstitution(null);
    setAccountName('');
    setBalanceText('');
    setSearch('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setSelectedInstitution(null);
        setSearch('');
        onClose();
      }}
      title={selectedInstitution ? 'Opening Balance' : 'Select Bank or Wallet'}
    >
      <View style={styles.container}>
        {!selectedInstitution ? (
          <>
            <View style={{ marginBottom: spacing.md }}>
              <TextInput
                placeholder="Search Nigerian banks, Kuda, OPay, GTBank..."
                value={search}
                onChangeText={setSearch}
                leftElement={<Search size={18} color={colors.textTertiary} />}
                autoFocus
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.bankRow,
                    {
                      borderBottomColor: colors.borderSubtle,
                      borderRadius: radii.md,
                    },
                  ]}
                  onPress={() => handleSelectInstitution(item)}
                >
                  <View
                    style={[
                      styles.avatarBadge,
                      {
                        backgroundColor: colors.primaryLight,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        {
                          color: colors.primary,
                          fontFamily: typography.fonts.semiBold,
                        },
                      ]}
                    >
                      {item.initials}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text
                      style={[
                        styles.bankName,
                        {
                          color: colors.textPrimary,
                          fontFamily: typography.fonts.medium,
                          fontSize: typography.sizes.body,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </>
        ) : (
          <View>
            <TouchableOpacity
              onPress={() => setSelectedInstitution(null)}
              style={[styles.backBtn, { marginBottom: spacing.md }]}
            >
              <ArrowLeft size={16} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  marginLeft: spacing.xs,
                  fontFamily: typography.fonts.medium,
                }}
              >
                Change institution
              </Text>
            </TouchableOpacity>

            <View style={{ marginBottom: spacing.md }}>
              <TextInput
                label="Account Nickname"
                value={accountName}
                onChangeText={setAccountName}
                placeholder="e.g. GTBank Salary / Main"
              />
            </View>

            <View style={{ marginBottom: spacing.lg }}>
              <CurrencyInput
                label="Current / Opening Balance"
                value={balanceText}
                onChangeText={setBalanceText}
              />
            </View>

            <Button
              label="Save Bank Account"
              onPress={handleConfirm}
              variant="primary"
              size="lg"
            />
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
  },
  bankName: {},
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
