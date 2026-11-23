import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeToggle } from '../../src/design';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function AuthLayout() {
  const { colors } = useTheme();
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();

  // Already signed in: go on to Welcome or Home.
  if (status === 'signed-in' && user) return <Redirect href={user.setupComplete ? '/' : '/welcome'} />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      {/* Light by default; people can switch before they sign in. */}
      <View style={[styles.toggle, { top: insets.top + 16 }]}>
        <ThemeToggle size="sm" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggle: { position: 'absolute', right: 16 },
});
