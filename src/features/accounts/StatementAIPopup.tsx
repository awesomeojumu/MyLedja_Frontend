import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles, ShieldCheck } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

interface StatementAIPopupProps {
  visible: boolean;
  onClose: () => void;
  onEnable: () => void;
}

export function StatementAIPopup({
  visible,
  onClose,
  onEnable,
}: StatementAIPopupProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Smart Statement Reader">
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
          <Sparkles size={28} color={colors.primary} />
        </View>

        <Text
          style={[
            styles.headline,
            {
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.lg,
              textAlign: 'center',
              marginBottom: spacing.xs,
            },
          ]}
        >
          Automate PDF & CSV Parsing
        </Text>

        <Text
          style={[
            styles.body,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.bodySm,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: spacing.lg,
            },
          ]}
        >
          MyLedja can automatically extract transaction narrations, bank transfer fees, VAT, and timestamps from your Nigerian bank PDF & CSV exports.
        </Text>

        <View
          style={[
            styles.privacyBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.xl,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldCheck size={18} color={colors.statusSuccess} />
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              On-Device Confidentiality
            </Text>
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: spacing.xxs,
            }}
          >
            All statement parsing happens on your local client. Your confidential financial data is never sent to third-party advertisers.
          </Text>
        </View>

        <Button
          label="Enable Smart Assistant"
          onPress={() => {
            onEnable();
            onClose();
          }}
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
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {},
  body: {},
  privacyBox: {
    width: '100%',
    borderWidth: 1,
  },
});
