import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info, CheckCircle2 } from 'lucide-react-native';
import { useTheme, BottomSheet } from '../../design';

interface PillarFormulaSheetProps {
  visible: boolean;
  onClose: () => void;
  pillarName: string;
  score: number;
  explanation: string;
  formula: string;
  recommendation: string;
}

export function PillarFormulaSheet({
  visible,
  onClose,
  pillarName,
  score,
  explanation,
  formula,
  recommendation,
}: PillarFormulaSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`${pillarName} Analysis`}>
      <View style={styles.container}>
        <View
          style={[
            styles.scoreCard,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
            }}
          >
            Pillar Score
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.xxl,
              marginTop: spacing.xxs,
            }}
          >
            {score}/100
          </Text>
        </View>

        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.bodySm,
            lineHeight: 20,
            marginBottom: spacing.md,
          }}
        >
          {explanation}
        </Text>

        <View
          style={[
            styles.formulaBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Metric Formula
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
            }}
          >
            {formula}
          </Text>
        </View>

        <View
          style={[
            styles.recBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CheckCircle2 size={16} color={colors.statusSuccess} />
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              Actionable Recommendation
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
            {recommendation}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  scoreCard: {},
  formulaBox: {
    borderWidth: 1,
  },
  recBox: {
    borderWidth: 1,
  },
});
