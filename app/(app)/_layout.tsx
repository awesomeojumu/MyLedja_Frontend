import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Receipt,
  PieChart,
  Landmark,
  LayoutGrid,
} from 'lucide-react-native';

import { useTheme, useResponsive } from '../../src/design';
import { DesktopSidebar } from '../../src/features/frame/DesktopSidebar';
import { AppHeader } from '../../src/features/frame/AppHeader';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { WorkspaceProvider } from '../../src/data/workspace/WorkspaceProvider';

export default function AppLayout() {
  const { colors, typography } = useTheme();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { workspaceId } = useAuth();
  const activeWsId = workspaceId || '01a1d3f0-b2ae-7433-98e3-d2b16c4125b3';

  // Desktop & Large Tablet: Dual-pane with clean Sidebar + Top Header
  if (isDesktop && Platform.OS === 'web') {
    return (
      <WorkspaceProvider workspaceId={activeWsId}>
        <View style={[styles.desktopRoot, { backgroundColor: colors.background }]}>
          <DesktopSidebar />
          <View style={styles.desktopMainContent}>
            <AppHeader />
            <View style={[styles.desktopViewContainer, { backgroundColor: colors.background }]}>
              <Tabs
                screenOptions={{
                  headerShown: false,
                  tabBarStyle: { display: 'none' }, // Tab bar hidden on desktop
                }}
              >
                <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
                <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
                <Tabs.Screen name="budget" options={{ title: 'Budget' }} />
                <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
                <Tabs.Screen name="more" options={{ title: 'More' }} />
                <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
                <Tabs.Screen name="debts" options={{ title: 'Debts' }} />
                <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
                <Tabs.Screen name="income" options={{ title: 'Income' }} />
                <Tabs.Screen name="investments" options={{ title: 'Investments' }} />
                <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
                <Tabs.Screen name="payees" options={{ title: 'Payees' }} />
                <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
                <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
                <Tabs.Screen name="rules" options={{ title: 'Rules' }} />
              </Tabs>
            </View>
          </View>
        </View>
      </WorkspaceProvider>
    );
  }

  const tabHeight = Platform.select({
    ios: 64 + insets.bottom,
    default: 74,
  });

  const tabBottomPadding = Platform.select({
    ios: Math.max(insets.bottom, 12),
    default: 8,
  });

  // Mobile & Small Screens: 5-Tab Bottom Navigation Bar
  return (
    <WorkspaceProvider workspaceId={activeWsId}>
      <View style={[styles.mobileRoot, { backgroundColor: colors.background }]}>
      <AppHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderSubtle,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: tabHeight,
            paddingTop: 4,
            paddingBottom: tabBottomPadding,
          },
          tabBarItemStyle: {
            paddingVertical: 0,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
          tabBarLabelStyle: {
            fontFamily: typography.fonts.medium,
            fontSize: 11,
            lineHeight: 14,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Home size={20} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Ledger',
            tabBarIcon: ({ color }) => <Receipt size={20} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            title: 'Budget',
            tabBarIcon: ({ color }) => <PieChart size={20} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: 'Accounts',
            tabBarIcon: ({ color }) => <Landmark size={20} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <LayoutGrid size={20} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="debts" options={{ title: 'Debts', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="income" options={{ title: 'Income', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="investments" options={{ title: 'Investments', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="notifications" options={{ title: 'Notifications', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="payees" options={{ title: 'Payees', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="rules" options={{ title: 'Rules', tabBarItemStyle: { display: 'none' } }} />
      </Tabs>
    </View>
    </WorkspaceProvider>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    overflow: 'hidden',
  },
  desktopMainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  desktopViewContainer: {
    flex: 1,
  },
  mobileRoot: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});
