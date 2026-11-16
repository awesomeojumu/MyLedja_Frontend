import React from 'react';
import { Stack } from 'expo-router';

export default function AccountsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/reconcile" options={{ headerShown: false }} />
    </Stack>
  );
}
