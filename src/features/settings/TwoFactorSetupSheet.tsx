import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

import { t as i18nT } from '../../i18n';
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
    <BottomSheet visible={visible} onClose={onClose} title={i18nT('ui.twoFactorSetupSheet.setUpTwoFactorAuthentication')}>
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
          {i18nT('ui.twoFactorSetupSheet.addAnExtraLayerOf')}
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
            label={i18nT('ui.twoFactorSetupSheet.enter6DigitAuthenticatorCode')}
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
          label={i18nT('ui.twoFactorSetupSheet.verifyAndActivate2fa')}
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
