import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

import { t } from '../../i18n';
export interface PasskeyPromptSheetProps {
  visible: boolean;
  onClose: () => void;
  onAuthenticate: () => Promise<void>;
}

export function PasskeyPromptSheet({ visible, onClose, onAuthenticate }: PasskeyPromptSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrigger = async () => {
    setLoading(true);
    setError('');
    try {
      await onAuthenticate();
      onClose();
    } catch {
      setError('Passkey authentication failed or was cancelled. Try again or use password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('ui.passkeyPromptSheet.signInWithPasskey')}
      subtitle="Use Face ID, Touch ID, or your device screen lock"
    >
      <View style={styles.container}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radii.full,
              padding: spacing.lg,
              alignSelf: 'center',
              marginBottom: spacing.md,
            },
          ]}
        >
          <Fingerprint size={40} color={colors.primary} />
        </View>

        <Text
          style={[
            styles.description,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.bodySm,
              textAlign: 'center',
              marginBottom: spacing.lg,
            },
          ]}
        >
          {t('ui.passkeyPromptSheet.passkeysAreEndToEnd')}
        </Text>

        {error ? (
          <Text
            style={[
              styles.errorText,
              {
                color: colors.statusDanger,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                textAlign: 'center',
                marginBottom: spacing.md,
              },
            ]}
          >
            {error}
          </Text>
        ) : null}

        <View style={{ gap: 8 }}>
          <Button
            label={t('ui.passkeyPromptSheet.scanBiometrics')}
            onPress={handleTrigger}
            variant="primary"
            loading={loading}
            size="lg"
          />
          <Button label={t('ui.passkeyPromptSheet.cancel')} onPress={onClose} variant="ghost" />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  iconWrap: {},
  description: {},
  errorText: {},
});
