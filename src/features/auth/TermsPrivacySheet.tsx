import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, Button } from '../../design';

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
      title="Terms & Privacy Policy"
      subtitle="Your financial data is private, encrypted, and isolated"
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionHeading, { color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md }]}>
          1. Data Privacy & Zero Tracking
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm, marginVertical: spacing.xs }]}>
          MyLedja does not sell, broker, or monetize your financial data. We never store full bank account numbers, BVNs, or full debit/credit card numbers.
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: spacing.md }]}>
          2. Workspace Isolation
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm, marginVertical: spacing.xs }]}>
          All transactions, accounts, envelopes, and reports are partitioned strictly by workspace. Only authorized members of your workspace can access your records.
        </Text>

        <Text style={[styles.sectionHeading, { color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: spacing.md }]}>
          3. Account Deletion
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm, marginVertical: spacing.xs }]}>
          You can request complete account deletion at any time in Settings. All backups, ledger entries, and audit logs are permanently wiped within 30 days.
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            label="I Understand & Agree"
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
