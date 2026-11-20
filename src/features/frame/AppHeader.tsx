import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { useTheme, ThemeToggle, useResponsive } from '../../design';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  unreadNotifications?: number;
}

export function AppHeader({ title, subtitle, unreadNotifications = 0 }: AppHeaderProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Dynamically resolve page title from active route when not explicitly overridden
  const routeMeta = useMemo(() => {
    if (title) return { title, subtitle };

    const path = pathname || '/';
    if (path === '/' || path === '') {
      return { title: 'Dashboard' };
    }
    if (path.startsWith('/transactions')) {
      return { title: 'Transactions' };
    }
    if (path.startsWith('/budget')) {
      return { title: 'Budget' };
    }
    if (path.startsWith('/accounts')) {
      return { title: 'Accounts' };
    }
    if (path.startsWith('/plan')) {
      return { title: 'Bills & Recurring' };
    }
    if (path.startsWith('/debts')) {
      return { title: 'Debts & Loans' };
    }
    if (path.startsWith('/goals')) {
      return { title: 'Savings Goals' };
    }
    if (path.startsWith('/investments')) {
      return { title: 'Investments' };
    }
    if (path.startsWith('/health')) {
      return { title: 'Health Score' };
    }
    if (path.startsWith('/reports')) {
      return { title: 'Reports' };
    }
    if (path.startsWith('/rules')) {
      return { title: 'Rules' };
    }
    if (path.startsWith('/settings')) {
      return { title: 'Settings' };
    }
    if (path.startsWith('/notifications')) {
      return { title: 'Notifications' };
    }
    if (path.startsWith('/income')) {
      return { title: 'Income Plan' };
    }
    if (path.startsWith('/payees')) {
      return { title: 'Payees' };
    }

    return { title: 'MyLedja' };
  }, [title, subtitle, pathname]);

  // On iOS and Android, make sure there is generous room for the status bar, notch, dynamic island,
  // and system swipe-down gestures (control center / notification shade).
  const nativeTopInset = Platform.select({
    ios: insets.top,
    android: Math.max(insets.top, StatusBar.currentHeight ?? 0),
    default: insets.top,
  });

  const isDesktopWeb = isDesktop && Platform.OS === 'web';

  const topPadding = isDesktopWeb
    ? spacing.md
    : Math.max(nativeTopInset, 16) + (nativeTopInset > 0 ? 6 : 10);

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingHorizontal: spacing.lg,
          paddingTop: topPadding,
          paddingBottom: spacing.md,
        },
      ]}
    >
      <View style={styles.titleArea}>
        <Text
          style={[
            styles.title,
            {
              color: colors.textPrimary,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.lg,
            },
          ]}
        >
          {routeMeta.title}
        </Text>
        {routeMeta.subtitle ? (
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.sm,
              },
            ]}
          >
            {routeMeta.subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <ThemeToggle size="sm" />

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          onPress={() => router.push('/notifications' as any)}
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
              borderRadius: radii.full,
              marginLeft: spacing.sm,
            },
          ]}
        >
          <Bell size={18} color={colors.textPrimary} />
          {unreadNotifications > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.statusDanger }]} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleArea: {
    flex: 1,
  },
  title: {
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
