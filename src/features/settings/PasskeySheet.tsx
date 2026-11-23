import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';

import { t } from '../../i18n';
interface PasskeySheetProps {
  visible: boolean;
  onClose: () => void;
  onEnrolled: (name: string) => void;
}

export function PasskeySheet({
  visible,
  onClose,
  onEnrolled,
}: PasskeySheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [deviceName, setDeviceName] = useState('My iPhone / Windows Hello');
  const [loading, setLoading] = useState(false);

  const handleEnroll = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onEnrolled(deviceName.trim() || 'Biometric Passkey');
      onClose();
    }, 600);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('ui.passkeySheet.enrollPasskey')}>
      <View style={styles.container}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radii.full,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Fingerprint size={32} color={colors.primary} />
        </View>

        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            textAlign: 'center',
            marginBottom: spacing.xs,
          }}
        >
          {t('ui.passkeySheet.passwordlessBiometricSignIn')}
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.bodySm,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: spacing.lg,
          }}
        >
          {t('ui.passkeySheet.signInInstantlyUsingTouch')}
        </Text>

        <View style={{ marginBottom: spacing.lg, width: '100%' }}>
          <TextInput
            label={t('ui.passkeySheet.deviceNickname')}
            value={deviceName}
            onChangeText={setDeviceName}
            placeholder={t('ui.passkeySheet.eGWorkMacbookIphone')}
          />
        </View>

        <Button
          label={t('ui.passkeySheet.activateBiometricPasskey')}
          onPress={handleEnroll}
          variant="primary"
          size="lg"
          loading={loading}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
