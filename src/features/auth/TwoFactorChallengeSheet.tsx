import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

export interface TwoFactorChallengeSheetProps {
  visible: boolean;
  onClose: () => void;
  onVerify: (code: string) => void;
}

export function TwoFactorChallengeSheet({
  visible,
  onClose,
  onVerify,
}: TwoFactorChallengeSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = () => {
    if (!code.trim() || (!useBackupCode && code.trim().length !== 6)) {
      setError(useBackupCode ? 'Please enter a backup code' : 'Enter a 6-digit code');
      return;
    }
    setError('');
    onVerify(code.trim());
    setCode('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Two-Factor Verification"
      subtitle={useBackupCode ? 'Enter one of your 8-digit emergency backup codes' : 'Enter the 6-digit code from your authenticator app'}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radii.full,
              padding: spacing.md,
              alignSelf: 'center',
              marginBottom: spacing.md,
            },
          ]}
        >
          <ShieldCheck size={28} color={colors.primary} />
        </View>

        <TextInput
          label={useBackupCode ? 'Backup Code' : '6-Digit Code'}
          placeholder={useBackupCode ? 'e.g. 8492-0194' : '123456'}
          maxLength={useBackupCode ? 12 : 6}
          keyboardType={useBackupCode ? 'default' : 'numeric'}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            if (error) setError('');
            // Auto submit when 6th digit entered
            if (!useBackupCode && v.length === 6) {
              onVerify(v);
              onClose();
            }
          }}
          error={error}
          style={{ letterSpacing: 4, textAlign: 'center', fontSize: typography.sizes.lg }}
        />

        <View style={{ marginTop: spacing.lg, gap: 8 }}>
          <Button label="Verify & Sign In" onPress={handleVerify} variant="primary" size="lg" />
          <Button
            label={useBackupCode ? 'Use Authenticator App' : 'Use a backup code instead'}
            onPress={() => {
              setUseBackupCode((prev) => !prev);
              setCode('');
              setError('');
            }}
            variant="ghost"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  iconWrap: {},
});
