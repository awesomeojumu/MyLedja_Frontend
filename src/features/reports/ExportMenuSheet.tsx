import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FileText, FileSpreadsheet, Image as ImageIcon } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

interface ExportMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  reportTitle: string;
  onExport: (format: 'pdf' | 'csv' | 'png') => void;
}

export function ExportMenuSheet({
  visible,
  onClose,
  reportTitle,
  onExport,
}: ExportMenuSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Export ${reportTitle}`}>
      <View style={styles.container}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.bodySm,
            marginBottom: spacing.md,
          }}
        >
          Choose your preferred download format:
        </Text>

        {[
          { id: 'pdf', label: 'PDF Document', desc: 'Formatted report with charts & summaries', icon: FileText },
          { id: 'csv', label: 'CSV Spreadsheet', desc: 'Raw tabular transaction and category rows', icon: FileSpreadsheet },
          { id: 'png', label: 'PNG Image', desc: 'High-res visual chart for presentations', icon: ImageIcon },
        ].map((item) => {
          const IconComponent = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                onExport(item.id as any);
                onClose();
              }}
              style={[
                styles.optionRow,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <IconComponent size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {item.label}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {item.desc}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  optionRow: {
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
