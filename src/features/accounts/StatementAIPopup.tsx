import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles, ShieldCheck } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

import { t } from '../../i18n';
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
    <BottomSheet visible={visible} onClose={onClose} title={t('ui.statementAipopup.smartStatementReader')}>
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
          {t('ui.statementAipopup.automatePdfAndCsvParsing')}
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
          {t('ui.statementAipopup.myledjaCanAutomaticallyExtractTransaction')}
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
              {t('ui.statementAipopup.onDeviceConfidentiality')}
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
            {t('ui.statementAipopup.allStatementParsingHappensOn')}
          </Text>
        </View>

        <Button
          label={t('ui.statementAipopup.enableSmartAssistant')}
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
