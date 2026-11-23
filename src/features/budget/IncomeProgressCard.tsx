import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrendingUp, ChevronDown, ChevronUp, Pencil, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../design';
import { useResponsive } from '../../design/size';
import { formatNaira } from '../../money';

import { t } from '../../i18n';
export interface IncomeStreamItem {
  id: string;
  name: string;
  expectedMinor: bigint;
  receivedMinor: bigint;
  subcategories: string[];
  subBudgets?: Record<string, bigint>;
  isEarmarked?: boolean;
  targetExpenseCategory?: string;
}

export interface IncomeProgressCardProps {
  streams: IncomeStreamItem[];
  totalExpectedMinor: bigint;
  totalReceivedMinor: bigint;
  onOpenEditIncome: () => void;
  onEditStream?: (stream: IncomeStreamItem) => void;
}

export function IncomeProgressCard({
  streams,
  totalExpectedMinor,
  totalReceivedMinor,
  onOpenEditIncome,
  onEditStream,
}: IncomeProgressCardProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop } = useResponsive();
  const [expanded, setExpanded] = useState(false);

  const pct =
    totalExpectedMinor > 0n
      ? Math.min(100, Math.round(Number((totalReceivedMinor * 100n) / totalExpectedMinor)))
      : 0;

  const isFullyReceived = totalReceivedMinor >= totalExpectedMinor && totalExpectedMinor > 0n;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.lg,
          paddingVertical: isDesktop ? 8 : 10,
          paddingHorizontal: isDesktop ? 12 : 14,
          marginBottom: spacing.sm + 2,
        },
      ]}
    >
      {/* Top Overview Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setExpanded((prev) => !prev)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: radii.full,
              backgroundColor: isFullyReceived ? colors.statusSuccessLight : colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isFullyReceived ? (
              <CheckCircle2 size={14} color={colors.statusSuccess} />
            ) : (
              <TrendingUp size={14} color={colors.primary} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: typography.fonts.semiBold,
                  color: colors.textPrimary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t('ui.incomeProgressCard.expectedIncomeStreams')}
              </Text>

              <View
                style={{
                  backgroundColor: isFullyReceived ? colors.statusSuccessLight : colors.primaryLight,
                  borderRadius: radii.full,
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: typography.fonts.semiBold,
                    color: isFullyReceived ? colors.statusSuccess : colors.primary,
                  }}
                >
                  {pct}{t('ui.incomeProgressCard.received')}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
              {t('ui.incomeProgressCard.received2')}{' '}{formatNaira(totalReceivedMinor)}{' '}{t('ui.incomeProgressCard.of')}{' '}{formatNaira(totalExpectedMinor)}
            </Text>
          </View>

          {expanded ? (
            <ChevronUp size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
          ) : (
            <ChevronDown size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
          )}
        </TouchableOpacity>

        {/* Edit Button */}
        <TouchableOpacity
          onPress={onOpenEditIncome}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3.5,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceSubtle,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.borderSubtle,
            marginLeft: 8,
          }}
        >
          <Pencil size={11} color={colors.textSecondary} />
          <Text style={{ fontSize: 10.5, fontFamily: typography.fonts.medium, color: colors.textSecondary }}>
            {t('ui.incomeProgressCard.planIncome')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.full,
            height: 3.5,
            marginTop: 6,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: isFullyReceived ? colors.statusSuccess : colors.primary,
              borderRadius: radii.full,
              width: `${pct}%`,
            },
          ]}
        />
      </View>

      {/* Expanded Breakdown of Active Income Streams */}
      {expanded && (
        <View
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.borderSubtle,
          }}
        >
          {streams.map((stream) => {
            const streamPct =
              stream.expectedMinor > 0n
                ? Math.min(100, Math.round(Number((stream.receivedMinor * 100n) / stream.expectedMinor)))
                : 100;

            return (
              <TouchableOpacity
                key={stream.id}
                activeOpacity={0.7}
                onPress={() => onEditStream ? onEditStream(stream) : onOpenEditIncome()}
                style={[
                  styles.streamRow,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderRadius: radii.sm,
                    borderColor: colors.borderSubtle,
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                    marginBottom: 4,
                  },
                ]}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, fontFamily: typography.fonts.semiBold, color: colors.textPrimary }}>
                      {stream.name}
                    </Text>
                    {stream.isEarmarked && (
                      <View
                        style={{
                          backgroundColor: colors.surface,
                          borderRadius: radii.full,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.borderSubtle,
                        }}
                      >
                        <Text style={{ fontSize: 9, color: colors.statusWarning, fontFamily: typography.fonts.medium }}>
                          {t('ui.incomeProgressCard.earmarked')}{stream.targetExpenseCategory || 'Needs'})
                        </Text>
                      </View>
                    )}
                  </View>

                  {stream.subcategories && stream.subcategories.length > 0 && (
                    <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
                      {stream.subcategories.slice(0, 3).join(' · ')}
                      {stream.subcategories.length > 3 ? ` +${stream.subcategories.length - 3}` : ''}
                    </Text>
                  )}
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11.5, fontFamily: typography.fonts.semiBold, color: colors.textPrimary }}>
                    {formatNaira(stream.expectedMinor)}
                  </Text>
                  <Text style={{ fontSize: 9.5, color: colors.textTertiary, marginTop: 1 }}>
                    {formatNaira(stream.receivedMinor)}{' '}{t('ui.incomeProgressCard.received3')}{streamPct}%)
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: {
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  streamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
