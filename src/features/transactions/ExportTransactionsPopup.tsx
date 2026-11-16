import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileSpreadsheet, Download } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

export interface ExportTransactionsPopupProps {
  visible: boolean;
  onClose: () => void;
  transactionCount: number;
  onExport: () => void;
}

export function ExportTransactionsPopup({
  visible,
  onClose,
  transactionCount,
  onExport,
}: ExportTransactionsPopupProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      onExport();
      setDownloading(false);
      onClose();
    }, 600);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Export Ledger"
      subtitle="Download your transactions as a spreadsheet"
    >
      <View style={styles.container}>
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              alignItems: 'center',
            },
          ]}
        >
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.full,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <FileSpreadsheet size={28} color={colors.primary} />
          </View>

          <Text
            style={[
              styles.infoTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.md,
              },
            ]}
          >
            CSV Format Export
          </Text>
          <Text
            style={[
              styles.infoSubtitle,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.sm,
                textAlign: 'center',
                marginTop: 4,
              },
            ]}
          >
            Exporting {transactionCount} ledger entries with full dates, amounts, categories, accounts, and payees.
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={downloading ? 'Preparing File...' : 'Download CSV File'}
            onPress={handleDownload}
            variant="primary"
            loading={downloading}
            icon={<Download size={18} color="#FFFFFF" />}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  infoCard: { borderWidth: 1 },
  iconBox: {},
  infoTitle: {},
  infoSubtitle: {},
});
