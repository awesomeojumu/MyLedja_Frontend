import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/design';

export default function SetupLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
