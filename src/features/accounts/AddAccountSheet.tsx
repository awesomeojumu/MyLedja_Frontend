import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, CurrencyInput, TextInput, Dropdown, Button } from '../../design';
import type { AccountData } from './AccountCardRow';

export interface AddAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaveAccount: (account: Omit<AccountData, 'id'>) => void;
}

const PURPOSEFUL_ACCOUNT_TYPES: {
  label: string;
  value: AccountData['type'];
  category: AccountData['category'];
  subtitle: string;
}[] = [
  {
    label: 'Income Account',
    value: 'income',
    category: 'liquid',
    subtitle: 'Receives salary, business profits, gifts and other income.',
  },
  {
    label: 'Operating Account',
    value: 'operating',
    category: 'liquid',
    subtitle: 'Handles daily spending, transfers and general expenses.',
  },
  {
    label: 'Bills Account',
    value: 'bills',
    category: 'liquid',
    subtitle: 'Rent, utilities, subscriptions, internet and recurring obligations.',
  },
  {
    label: 'Emergency Fund Account',
    value: 'emergency',
    category: 'liquid',
    subtitle: 'Unexpected expenses and financial emergencies.',
  },
  {
    label: 'Savings Account',
    value: 'savings',
    category: 'liquid',
    subtitle: 'Short- and medium-term financial goals.',
  },
  {
    label: 'Investment Account',
    value: 'investment',
    category: 'investment',
    subtitle: 'Funds allocated to investments and wealth creation.',
  },
  {
    label: 'Project Account',
    value: 'project',
    category: 'liquid',
    subtitle: 'Specific targets such as buying a car, building a house, travel or major purchases.',
  },
];

export function AddAccountSheet({ visible, onClose, onSaveAccount }: AddAccountSheetProps) {
  const { spacing } = useTheme();

  const [selectedType, setSelectedType] = useState<AccountData['type']>('operating');
  const [institution, setInstitution] = useState('');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please give your account a name or nickname');
      return;
    }
    setError('');

    const minor = balance ? BigInt(Math.round(parseFloat(balance) * 100)) : 0n;
    const typeDef = PURPOSEFUL_ACCOUNT_TYPES.find((t) => t.value === selectedType) ?? PURPOSEFUL_ACCOUNT_TYPES[1]!;

    onSaveAccount({
      name: name.trim(),
      institution: institution.trim() || 'Bank / Institution',
      category: typeDef.category,
      type: selectedType,
      balanceMinor: minor,
    });

    setName('');
    setInstitution('');
    setBalance('');
    setSelectedType('operating');
    onClose();
  };

  const dropdownOptions = PURPOSEFUL_ACCOUNT_TYPES.map((t) => ({
    label: t.label,
    value: t.value,
    subtitle: t.subtitle,
  }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add New Account"
      subtitle="Select account purpose and enter financial institution"
    >
      <View style={styles.form}>
        {/* 1. Account Purpose Type Dropdown */}
        <View style={{ marginBottom: spacing.md }}>
          <Dropdown
            label="Account Purpose & Type"
            placeholder="Select Account Purpose"
            value={selectedType}
            options={dropdownOptions}
            onSelect={(val) => setSelectedType(val as AccountData['type'])}
          />
        </View>

        {/* 2. Bank / Financial Institution (TextInput) */}
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Financial Institution / Bank"
            placeholder="e.g. PremiumTrust Bank, GTBank, Kuda, Zenith"
            value={institution}
            onChangeText={setInstitution}
          />
        </View>

        {/* 3. Account Nickname */}
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label="Account Nickname"
            placeholder="e.g. Primary Operating, Emergency Vault"
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        {/* 4. Opening Balance */}
        <View style={{ marginBottom: spacing.lg }}>
          <CurrencyInput
            value={balance}
            onChangeText={setBalance}
            label="Opening Balance"
            placeholder="0.00"
          />
        </View>

        {/* 5. Save Button */}
        <View style={{ marginTop: spacing.xs }}>
          <Button label="Save Account" onPress={handleSave} variant="primary" size="lg" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
});
