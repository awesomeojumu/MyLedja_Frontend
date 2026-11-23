import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

import { t as i18nT } from '../../i18n';
interface EditAccountPopupProps {
  visible: boolean;
  onClose: () => void;
  account: {
    id: string;
    name: string;
    accountNumber?: string;
  };
  onSave: (updated: { name: string; accountNumber?: string }) => void;
  onDelete?: () => void;
}

export function EditAccountPopup({
  visible,
  onClose,
  account,
  onSave,
  onDelete,
}: EditAccountPopupProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [name, setName] = useState(account.name);
  const [accountNumber, setAccountNumber] = useState(account.accountNumber || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Account name is required');
      return;
    }
    onSave({
      name: name.trim(),
      accountNumber: accountNumber.trim(),
    });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={i18nT('ui.editAccountPopup.editAccount')}>
      <View style={styles.container}>
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            label={i18nT('ui.editAccountPopup.accountName')}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            error={error}
          />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label={i18nT('ui.editAccountPopup.accountNumberOptional')}
            placeholder={i18nT('ui.editAccountPopup.eG0123456789')}
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
          />
        </View>

        <Button
          label={i18nT('ui.editAccountPopup.saveChanges')}
          onPress={handleSave}
          variant="primary"
          size="lg"
        />

        {onDelete && (
          <TouchableOpacity
            onPress={() => {
              onDelete();
              onClose();
            }}
            style={[
              styles.deleteBtn,
              {
                marginTop: spacing.md,
                padding: spacing.sm,
                borderRadius: radii.md,
              },
            ]}
          >
            <Trash2 size={16} color={colors.statusDanger} />
            <Text
              style={{
                color: colors.statusDanger,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              {i18nT('ui.editAccountPopup.closeOrDeleteAccount')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
