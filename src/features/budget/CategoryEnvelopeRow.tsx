import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pencil, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../../design';
import { useResponsive } from '../../design/size';
import { formatNaira } from '../../money';

export interface CategoryEnvelope {
  id: string;
  name: string;
  group: string;
  plannedMinor: bigint;
  spentMinor: bigint;
  subcategories?: string[];
  subBudgets?: Record<string, bigint>;
}

export interface CategoryEnvelopeRowProps {
  envelope: CategoryEnvelope;
  onPress: () => void;
}

export function CategoryEnvelopeRow({ envelope, onPress }: CategoryEnvelopeRowProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop } = useResponsive();
  const [expanded, setExpanded] = useState(false);

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

  // DESKTOP: Compact single-row layout
  if (isDesktop) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[
          styles.row,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderSubtle,
            paddingVertical: 7,
            paddingHorizontal: 12,
          },
        ]}
      >
        <View style={styles.topInfo}>
          <View style={{ flex: 1, marginRight: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: 13,
              }}
            >
              {envelope.name}
            </Text>
            {envelope.subcategories && envelope.subcategories.length > 0 && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setExpanded((prev) => !prev);
                }}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.primary,
                    fontSize: 10.5,
                  }}
                >
                  ({envelope.subcategories.slice(0, 3).join(', ')}
                  {envelope.subcategories.length > 3 ? ` +${envelope.subcategories.length - 3}` : ''})
                </Text>
                {expanded ? (
                  <ChevronUp size={11} color={colors.primary} style={{ marginLeft: 2 }} />
                ) : (
                  <ChevronDown size={11} color={colors.primary} style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[
                styles.status,
                {
                  color: statusColor,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 11.5,
                },
              ]}
            >
              {statusText}
            </Text>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceSubtle,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              <Pencil size={10} color={colors.textSecondary} />
            </View>
          </View>
        </View>

        {/* Slim Progress Track */}
        <View
          style={[
            styles.track,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              height: 3.5,
              marginVertical: 3,
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
                fontSize: 10.5,
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
                fontFamily: typography.fonts.medium,
                fontSize: 10.5,
              },
            ]}
          >
            {percentage}%
          </Text>
        </View>

        {/* Inline Subcategories Breakdown Drawer */}
        {expanded && envelope.subcategories && envelope.subcategories.length > 0 && (
          <View
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {envelope.subcategories.map((sub) => {
                const subLimit = envelope.subBudgets?.[sub];
                return (
                  <View
                    key={sub}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.sm,
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, color: colors.textPrimary, fontFamily: typography.fonts.medium }}>
                      {sub}
                    </Text>
                    {subLimit !== undefined && (
                      <Text style={{ fontSize: 10, color: colors.primary, fontFamily: typography.fonts.semiBold, marginLeft: 4 }}>
                        {formatNaira(subLimit)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // MOBILE: Spacious stacked touch-friendly layout
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderSubtle,
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
      ]}
    >
      <View style={styles.topInfo}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.body,
            flex: 1,
            marginRight: spacing.sm,
          }}
        >
          {envelope.name}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={[
              styles.status,
              {
                color: statusColor,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.sm,
              },
            ]}
          >
            {statusText}
          </Text>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radii.full,
              backgroundColor: colors.surfaceSubtle,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.8,
            }}
          >
            <Pencil size={11} color={colors.textSecondary} />
          </View>
        </View>
      </View>

      {envelope.subcategories && envelope.subcategories.length > 0 && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            setExpanded((prev) => !prev);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 2 }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: colors.primary,
              fontSize: 11,
              fontFamily: typography.fonts.medium,
            }}
          >
            {envelope.subcategories.slice(0, 3).join(' · ')}
            {envelope.subcategories.length > 3 ? ` +${envelope.subcategories.length - 3} more` : ''}
          </Text>
          {expanded ? (
            <ChevronUp size={12} color={colors.primary} style={{ marginLeft: 3 }} />
          ) : (
            <ChevronDown size={12} color={colors.primary} style={{ marginLeft: 3 }} />
          )}
        </TouchableOpacity>
      )}

      {/* Standard Mobile Progress Track */}
      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.full,
            height: 5,
            marginVertical: 5,
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
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
            },
          ]}
        >
          {percentage}%
        </Text>
      </View>

      {/* Mobile Inline Subcategories Breakdown Drawer */}
      {expanded && envelope.subcategories && envelope.subcategories.length > 0 && (
        <View
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {envelope.subcategories.map((sub) => {
              const subLimit = envelope.subBudgets?.[sub];
              return (
                <View
                  key={sub}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.sm,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textPrimary, fontFamily: typography.fonts.medium }}>
                    {sub}
                  </Text>
                  {subLimit !== undefined && (
                    <Text style={{ fontSize: 11, color: colors.primary, fontFamily: typography.fonts.semiBold, marginLeft: 4 }}>
                      {formatNaira(subLimit)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
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
