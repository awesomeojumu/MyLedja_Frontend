import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MessageSquare, Copy } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import { formatNaira } from '../../money';

interface ReminderMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  personName: string;
  amountMinor: bigint;
  dueDate?: string;
}

export function ReminderMessageSheet({
  visible,
  onClose,
  personName,
  amountMinor,
  dueDate,
}: ReminderMessageSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const formattedAmount = formatNaira(amountMinor);
  const message = `Hi ${personName}, gentle reminder regarding the outstanding balance of ${formattedAmount}${
    dueDate ? ` due on ${dueDate}` : ''
  }. Whenever you're ready to make a transfer, please send to my GTBank account. Thanks!`;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="WhatsApp Reminder Generator">
      <View style={styles.container}>
        <View
          style={[
            styles.previewBox,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <MessageSquare size={16} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.xs,
                marginLeft: 4,
              }}
            >
              PREVIEW MESSAGE
            </Text>
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.bodySm,
              lineHeight: 22,
            }}
          >
            {message}
          </Text>
        </View>

        <Button
          label="Copy Message to Clipboard"
          onPress={onClose}
          variant="primary"
          size="lg"
          icon={<Copy size={16} color="#FFFFFF" />}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  previewBox: {
    borderWidth: 1,
  },
});
