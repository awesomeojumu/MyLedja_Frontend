import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { useTheme } from '../../design';

export interface MonthScopeBarProps {
  currentMonth: string;
  isCurrentMonth?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onResetToCurrent?: () => void;
}

export function MonthScopeBar({
  currentMonth,
  isCurrentMonth = true,
  onPrevMonth,
  onNextMonth,
  onResetToCurrent,
}: MonthScopeBarProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <View style={[styles.container, { marginBottom: spacing.md }]}>
      <View style={styles.leftArea}>
        <View style={styles.navigator}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={onPrevMonth}
            style={[
              styles.navBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.full,
              },
            ]}
          >
            <ChevronLeft size={16} color={colors.textPrimary} />
          </TouchableOpacity>

          <View
            style={[
              styles.monthPill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.full,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                marginHorizontal: spacing.xs,
              },
            ]}
          >
            <Calendar size={13} color={colors.primary} style={{ marginRight: 6 }} />
            <Text
              style={[
                styles.monthText,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.xs,
                  marginRight: 6,
                },
              ]}
            >
              {currentMonth}
            </Text>

            {isCurrentMonth ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: colors.primary,
                      fontFamily: typography.fonts.medium,
                      fontSize: 10,
                    },
                  ]}
                >
                  This Month
                </Text>
              </View>
            ) : (
              <TouchableOpacity onPress={onResetToCurrent}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.full,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: colors.textSecondary,
                        fontFamily: typography.fonts.medium,
                        fontSize: 10,
                      },
                    ]}
                  >
                    Go to current
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={onNextMonth}
            style={[
              styles.navBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.full,
              },
            ]}
          >
            <ChevronRight size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  leftArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  monthText: {},
  badge: {},
  badgeText: {},
});
