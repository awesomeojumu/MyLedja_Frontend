import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldCheck, Copy, Check } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

interface TwoFactorSetupSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (code: string) => void;
}

export function TwoFactorSetupSheet({
  visible,
  onClose,
  onConfirm,
}: TwoFactorSetupSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [otp, setOtp] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const secretKey = 'JBSWY3DPEHPK3PXP';

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = () => {
    if (otp.length !== 6) {
      setError('Please enter a 6-digit verification code');
      return;
    }
    onConfirm(otp);
    setOtp('');
    setError('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Set Up Two-Factor Authentication">
      <View style={styles.container}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.bodySm,
            marginBottom: spacing.md,
            lineHeight: 20,
          }}
        >
          Add an extra layer of security. Enter this setup key into Google Authenticator or 1Password:
        </Text>

        <TouchableOpacity
          onPress={handleCopy}
          style={[
            styles.secretBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.md,
              letterSpacing: 2,
            }}
          >
            {secretKey}
          </Text>
          {copied ? (
            <Check size={18} color={colors.statusSuccess} />
          ) : (
            <Copy size={18} color={colors.primary} />
          )}
        </TouchableOpacity>

        <View style={{ marginBottom: spacing.lg }}>
          <TextInput
            label="Enter 6-Digit Authenticator Code"
            placeholder="123456"
            value={otp}
            onChangeText={(t) => {
              setOtp(t);
              if (error) setError('');
            }}
            keyboardType="number-pad"
            maxLength={6}
            error={error}
          />
        </View>

        <Button
          label="Verify & Activate 2FA"
          onPress={handleVerify}
          variant="primary"
          size="lg"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  secretBox: {
    borderWidth: 1,
  },
});
