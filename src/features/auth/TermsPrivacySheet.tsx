import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, Button } from '../../design';

import { t } from '../../i18n';
export interface TermsPrivacySheetProps {
  visible: boolean;
  onClose: () => void;
  /** Agreeing ticks the terms box on Sign up. */
  onAgree?: () => void;
}

export function TermsPrivacySheet({ visible, onClose, onAgree }: TermsPrivacySheetProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('ui.termsPrivacySheet.termsAndPrivacyPolicy')}
      subtitle="Your financial data is private, encrypted, and isolated"
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionHeading, { color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md }]}>
          {t('ui.termsPrivacySheet.1DataPrivacyAndZero')}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm, marginVertical: spacing.xs }]}>
          {t('ui.termsPrivacySheet.myledjaDoesNotSellBroker')}
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: spacing.md }]}>
          {t('ui.termsPrivacySheet.2WorkspaceIsolation')}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm, marginVertical: spacing.xs }]}>
          {t('ui.termsPrivacySheet.allTransactionsAccountsEnvelopesAnd')}
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: spacing.md }]}>
          {t('ui.termsPrivacySheet.3AccountDeletion')}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm, marginVertical: spacing.xs }]}>
          {t('ui.termsPrivacySheet.youCanRequestCompleteAccount')}
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={t('ui.termsPrivacySheet.iUnderstandAndAgree')}
            onPress={() => {
              onAgree?.();
              onClose();
            }}
            variant="primary"
            size="lg"
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { maxHeight: 400 },
  sectionHeading: {},
  body: {},
});
