import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeToggle } from '../../src/design';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function SetupLayout() {
  const { colors } = useTheme();
  const { status } = useAuth();
  const insets = useSafeAreaInsets();

  if (status === 'signed-out') return <Redirect href="/sign-in" />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      {/* Light by default; the choice carries into the app. */}
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
