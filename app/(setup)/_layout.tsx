import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useTheme } from '../../src/design';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function SetupLayout() {
  const { colors } = useTheme();
  const { status } = useAuth();

  if (status === 'signed-out') return <Redirect href="/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
