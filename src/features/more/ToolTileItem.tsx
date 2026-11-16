import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../design';

export interface ToolTileItemProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  badge?: string;
  onPress: () => void;
}

export function ToolTileItem({ title, subtitle, icon: IconComponent, badge, onPress }: ToolTileItemProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderSubtle,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: colors.primaryLight,
            borderRadius: radii.md,
            marginRight: spacing.md,
          },
        ]}
      >
        <IconComponent size={20} color={colors.primary} />
      </View>

      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.body,
              },
            ]}
          >
            {title}
          </Text>
          {badge && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.statusDangerLight,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.xs + 2,
                  paddingVertical: spacing.xxs,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: colors.statusDanger,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.xs,
                  },
                ]}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.subtitle,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: 2,
            },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      <ChevronRight size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    letterSpacing: -0.2,
  },
  badge: {},
  badgeText: {},
  subtitle: {},
});
