import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck, Share2 } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

interface ShareHealthSummarySheetProps {
  visible: boolean;
  onClose: () => void;
  overallScore: number;
  gradeText: string;
}

export function ShareHealthSummarySheet({
  visible,
  onClose,
  overallScore,
  gradeText,
}: ShareHealthSummarySheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Share Health Card">
      <View style={styles.container}>
        <View
          style={[
            styles.shareCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.xl,
              alignItems: 'center',
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 11,
              }}
            >
              MYLEDJA FINANCIAL HEALTH
            </Text>
          </View>

          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: 48,
            }}
          >
            {overallScore}
            <Text style={{ fontSize: typography.sizes.body, color: colors.textSecondary }}>/100</Text>
          </Text>

          <Text
            style={{
              color: colors.primary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.md,
              marginTop: spacing.xxs,
            }}
          >
            {gradeText}
          </Text>

          <View
            style={[
              styles.maskNote,
              {
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.lg,
              },
            ]}
          >
            <ShieldCheck size={14} color={colors.statusSuccess} />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fonts.regular,
                marginLeft: 4,
              }}
            >
              Private financial numbers & account balances are completely masked.
            </Text>
          </View>
        </View>

        <Button
          label="Copy Shareable Link"
          onPress={onClose}
          variant="primary"
          size="lg"
          icon={<Share2 size={16} color="#FFFFFF" />}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  shareCard: {
    borderWidth: 1,
  },
  badge: {},
  maskNote: {},
});
