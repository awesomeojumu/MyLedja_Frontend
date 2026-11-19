import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Landmark, Wallet, CreditCard } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export interface AccountItem {
  id: string;
  name: string;
  type: 'bank' | 'wallet' | 'card';
  balanceMinor: bigint;
}

export interface AccountsCarouselProps {
  accounts: AccountItem[];
  privacyMode: boolean;
  onSelectAccount?: (id: string) => void;
  onViewAll?: () => void;
}

export function AccountsCarousel({
  accounts,
  privacyMode,
  onSelectAccount,
  onViewAll,
}: AccountsCarouselProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const getIcon = (type: AccountItem['type']) => {
    switch (type) {
      case 'card':
        return CreditCard;
      case 'wallet':
        return Wallet;
      default:
        return Landmark;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { marginBottom: spacing.xs + 2 }]}>
        <Text
          style={[
            styles.heading,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            },
          ]}
        >
          Accounts
        </Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              }}
            >
              See all
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {accounts.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: 'dashed',
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            No accounts added yet. Tap See all to add an account.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: spacing.md }}
          style={styles.carousel}
        >
          {accounts.map((acc) => {
            const IconComponent = getIcon(acc.type);
            const isNegative = acc.balanceMinor < 0n;
            const formattedBalance = privacyMode ? '••••' : formatNaira(acc.balanceMinor);

            return (
              <TouchableOpacity
                key={acc.id}
                onPress={() => onSelectAccount?.(acc.id)}
                activeOpacity={0.7}
                style={[
                  styles.pill,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.full,
                    paddingVertical: 7,
                    paddingHorizontal: spacing.md,
                    marginRight: spacing.xs + 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: colors.primaryLight,
                      borderRadius: radii.full,
                      marginRight: spacing.xs,
                    },
                  ]}
                >
                  <IconComponent size={12} color={colors.primary} />
                </View>

                <Text
                  style={[
                    styles.accountName,
                    {
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.xs,
                      marginRight: spacing.xs + 2,
                    },
                  ]}
                >
                  {acc.name}
                </Text>

                <Text
                  style={[
                    styles.balance,
                    {
                      color: isNegative ? colors.statusDanger : colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: typography.sizes.xs,
                    },
                  ]}
                >
                  {formattedBalance}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {},
  carousel: {
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  iconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {},
  balance: {
    letterSpacing: -0.2,
  },
});
