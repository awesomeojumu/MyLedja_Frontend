import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, Plus } from 'lucide-react-native';
import { useTheme, BottomSheet } from '../../design';
import { formatNaira } from '../../money';

import { t } from '../../i18n';
interface DetectedCharge {
  id: string;
  name: string;
  amountMinor: bigint;
  dueDay: number;
  cadence: 'monthly' | 'quarterly' | 'annual';
}

interface RecurringSuggestionsPopupProps {
  visible: boolean;
  onClose: () => void;
  onAddSuggested: (charge: DetectedCharge) => void;
}

export function RecurringSuggestionsPopup({
  visible,
  onClose,
  onAddSuggested,
}: RecurringSuggestionsPopupProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const detected: DetectedCharge[] = [
    { id: 'det-1', name: 'Netflix Nigeria Standard', amountMinor: 450000n, dueDay: 18, cadence: 'monthly' },
    { id: 'det-2', name: 'Spotify Individual', amountMinor: 110000n, dueDay: 22, cadence: 'monthly' },
    { id: 'det-3', name: 'Google One Storage', amountMinor: 120000n, dueDay: 29, cadence: 'monthly' },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('ui.recurringSuggestionsPopup.detectedRecurringBills')}>
      <View style={styles.container}>
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Sparkles size={16} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              {t('ui.recurringSuggestionsPopup.smartPatternDetection')}
            </Text>
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: 4,
            }}
          >
            {t('ui.recurringSuggestionsPopup.weNoticedTheseChargesRecurring')}
          </Text>
        </View>

        {detected.map((item) => (
          <View
            key={item.id}
            style={[
              styles.itemRow,
              {
                borderBottomColor: colors.borderSubtle,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                {item.name}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                {t('ui.recurringSuggestionsPopup.dueOnThe')}{' '}{item.dueDay}{t('ui.recurringSuggestionsPopup.thMonthly')}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                  marginRight: spacing.md,
                }}
              >
                {formatNaira(item.amountMinor)}
              </Text>
              <TouchableOpacity
                onPress={() => onAddSuggested(item)}
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                  },
                ]}
              >
                <Plus size={12} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    fontFamily: typography.fonts.semiBold,
                    marginLeft: 2,
                  }}
                >
                  {t('ui.recurringSuggestionsPopup.add')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  banner: {},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
