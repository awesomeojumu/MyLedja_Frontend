import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Landmark, Wallet, CreditCard, TrendingUp, Building, Coins, Receipt, ShieldCheck, Target } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export type AccountCategory = 'liquid' | 'liability' | 'investment';

export interface AccountData {
  id: string;
  name: string;
  institution: string;
  category: AccountCategory;
  type:
    | 'income'
    | 'operating'
    | 'bills'
    | 'emergency'
    | 'savings'
    | 'investment'
    | 'project'
    | 'checking'
    | 'current'
    | 'wallet'
    | 'credit'
    | 'loan'
    | 'property';
  balanceMinor: bigint;
  currency?: string;
}

export interface AccountCardRowProps {
  account: AccountData;
  privacyMode: boolean;
  onPress: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  operating: 'Operating',
  bills: 'Bills',
  emergency: 'Emergency Fund',
  savings: 'Savings',
  investment: 'Investment',
  project: 'Project',
  checking: 'Checking',
  current: 'Current',
  wallet: 'Wallet',
  credit: 'Credit Card',
  loan: 'Loan',
  property: 'Property Asset',
};

export function AccountCardRow({ account, privacyMode, onPress }: AccountCardRowProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const getIcon = () => {
    switch (account.type) {
      case 'income':
        return Coins;
      case 'operating':
      case 'wallet':
        return Wallet;
      case 'bills':
        return Receipt;
      case 'emergency':
        return ShieldCheck;
      case 'savings':
      case 'checking':
      case 'current':
        return Landmark;
      case 'investment':
        return TrendingUp;
      case 'project':
        return Target;
      case 'credit':
      case 'loan':
        return CreditCard;
      case 'property':
        return Building;
      default:
        return Landmark;
    }
  };

  const IconComponent = getIcon();
  const isNegative = account.balanceMinor < 0n;
  const balanceColor = isNegative ? colors.statusDanger : colors.textPrimary;
  const formattedBalance = privacyMode
    ? '••••'
    : isNegative
    ? `−${formatNaira(-account.balanceMinor)}`
    : formatNaira(account.balanceMinor);

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
      <View style={styles.leftCol}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: isNegative ? colors.statusDangerLight : colors.primaryLight,
              borderRadius: radii.md,
              marginRight: spacing.md,
            },
          ]}
        >
          <IconComponent size={18} color={isNegative ? colors.statusDanger : colors.primary} />
        </View>

        <View style={styles.textContainer}>
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
            {account.name}
          </Text>

          <View style={styles.metaRow}>
            <Text
              style={[
                styles.institution,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                },
              ]}
            >
              {account.institution}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text
          style={[
            styles.balance,
            {
              color: balanceColor,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.body,
            },
          ]}
        >
          {formattedBalance}
        </Text>
        <Text
          style={[
            styles.typeLabel,
            {
              color: colors.textTertiary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: 2,
            },
          ]}
        >
          {TYPE_LABELS[account.type] ?? account.type}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  name: {
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  institution: {},
  lastFour: {},
  rightCol: {
    alignItems: 'flex-end',
  },
  balance: {
    letterSpacing: -0.2,
  },
  typeLabel: {},
});
