import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useTheme } from '../../src/design';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function AuthLayout() {
  const { colors } = useTheme();
  const { status, user } = useAuth();

  // Already signed in: go on to Welcome or Home.
  if (status === 'signed-in' && user) return <Redirect href={user.setupComplete ? '/' : '/welcome'} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
