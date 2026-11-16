import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, BottomSheet } from '../../design';
import { formatNaira } from '../../money';

export interface FlowNodeItem {
  id: string;
  label: string;
  amountMinor: bigint;
  percent: number;
  transactionsCount: number;
}

interface NodeBreakdownSheetProps {
  visible: boolean;
  onClose: () => void;
  nodeTitle: string;
  nodeTotalMinor: bigint;
  items: FlowNodeItem[];
}

export function NodeBreakdownSheet({
  visible,
  onClose,
  nodeTitle,
  nodeTotalMinor,
  items,
}: NodeBreakdownSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`${nodeTitle} Breakdown`}>
      <View style={styles.container}>
        <View
          style={[
            styles.totalCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
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
            Total Stream Flow
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.xxl,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(nodeTotalMinor)}
          </Text>
        </View>

        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.sm,
          }}
        >
          Contributing Categories
        </Text>

        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.row,
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
                {item.label}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                }}
              >
                {item.transactionsCount} transactions • {item.percent}% of stream
              </Text>
            </View>

            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.bodySm,
              }}
            >
              {formatNaira(item.amountMinor)}
            </Text>
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
  totalCard: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
