import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export interface CategoryEnvelope {
  id: string;
  name: string;
  group: string;
  plannedMinor: bigint;
  spentMinor: bigint;
}

export interface CategoryEnvelopeRowProps {
  envelope: CategoryEnvelope;
  onPress: () => void;
}

export function CategoryEnvelopeRow({ envelope, onPress }: CategoryEnvelopeRowProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const remainingMinor = envelope.plannedMinor - envelope.spentMinor;
  const isOver = remainingMinor < 0n;

  // Percentage calculation
  const percentage =
    envelope.plannedMinor > 0n
      ? Number((envelope.spentMinor * 100n) / envelope.plannedMinor)
      : 100;

  const progressClamped = Math.min(percentage, 100);

  // Status Colors
  let barColor = colors.primary;
  let statusText = `${formatNaira(remainingMinor)} left`;
  let statusColor = colors.primary;

  if (isOver) {
    barColor = colors.statusDanger;
    statusText = `Over by ${formatNaira(-remainingMinor)}`;
    statusColor = colors.statusDanger;
  } else if (percentage >= 80) {
    barColor = colors.statusWarning;
    statusText = `Near limit (${formatNaira(remainingMinor)} left)`;
    statusColor = colors.statusWarning;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderSubtle,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View style={styles.topInfo}>
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            {
              color: colors.textPrimary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.body,
            },
          ]}
        >
          {envelope.name}
        </Text>

        <Text
          style={[
            styles.status,
            {
              color: statusColor,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
            },
          ]}
        >
          {statusText}
        </Text>
      </View>

      {/* Progress Track */}
      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.full,
            height: 6,
            marginVertical: spacing.xs + 2,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: barColor,
              borderRadius: radii.full,
              width: `${progressClamped}%`,
            },
          ]}
        />
      </View>

      {/* Bottom Numbers */}
      <View style={styles.bottomNumbers}>
        <Text
          style={[
            styles.numbersText,
            {
              color: colors.textTertiary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            },
          ]}
        >
          Spent: {formatNaira(envelope.spentMinor)} of {formatNaira(envelope.plannedMinor)}
        </Text>

        <Text
          style={[
            styles.percentText,
            {
              color: colors.textTertiary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            },
          ]}
        >
          {percentage}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    marginRight: 8,
  },
  status: {},
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  bottomNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numbersText: {},
  percentText: {},
});
