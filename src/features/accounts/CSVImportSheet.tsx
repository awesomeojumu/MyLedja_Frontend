import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

interface CSVImportSheetProps {
  visible: boolean;
  onClose: () => void;
  accountName: string;
  onImportComplete: (count: number) => void;
}

export function CSVImportSheet({
  visible,
  onClose,
  accountName,
  onImportComplete,
}: CSVImportSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsedCount, setParsedCount] = useState<number>(0);

  const handleSimulatePickFile = () => {
    // In React Native Web / Mobile, user picks a CSV file
    setSelectedFile(`${accountName.toLowerCase().replace(/\s+/g, '_')}_statement_nov2026.csv`);
    setParsedCount(24);
  };

  const handleFinishImport = () => {
    if (!selectedFile) return;
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      onImportComplete(parsedCount);
      setSelectedFile(null);
      setParsedCount(0);
      onClose();
    }, 400);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setSelectedFile(null);
        setParsedCount(0);
        onClose();
      }}
      title={`Import Statement to ${accountName}`}
    >
      <View style={styles.container}>
        {!selectedFile ? (
          <TouchableOpacity
            onPress={handleSimulatePickFile}
            style={[
              styles.dropzone,
              {
                borderColor: colors.primary,
                backgroundColor: colors.primaryLight,
                borderRadius: radii.lg,
                padding: spacing.xl,
              },
            ]}
          >
            <UploadCloud size={36} color={colors.primary} />
            <Text
              style={[
                styles.dropzoneTitle,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.md,
                  marginTop: spacing.sm,
                },
              ]}
            >
              Choose bank statement CSV
            </Text>
            <Text
              style={[
                styles.dropzoneSub,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                  textAlign: 'center',
                },
              ]}
            >
              Supports GTBank, Access, Zenith, Kuda, Moniepoint & standard bank exports.
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View
              style={[
                styles.fileCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FileSpreadsheet size={24} color={colors.primary} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.body,
                    }}
                  >
                    {selectedFile}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.regular,
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    Ready • {parsedCount} transactions detected
                  </Text>
                </View>
                <CheckCircle2 size={20} color={colors.statusSuccess} />
              </View>

              <View
                style={[
                  styles.mappingBadge,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radii.sm,
                    marginTop: spacing.md,
                    padding: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.regular,
                  }}
                >
                  Columns matched: Date ➔ Date, Narration ➔ Description, Amount ➔ Amount
                </Text>
              </View>
            </View>

            <Button
              label={`Finish Import (${parsedCount} items)`}
              onPress={handleFinishImport}
              variant="primary"
              size="lg"
              loading={importing}
            />
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  dropzone: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  dropzoneTitle: {},
  dropzoneSub: {
    maxWidth: 280,
  },
  fileCard: {
    borderWidth: 1,
  },
  mappingBadge: {},
});
