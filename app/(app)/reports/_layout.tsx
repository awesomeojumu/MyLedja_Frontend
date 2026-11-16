import React from 'react';
import { Stack } from 'expo-router';

export default function ReportsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="build" options={{ headerShown: false }} />
      <Stack.Screen name="view/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
