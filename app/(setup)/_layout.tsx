import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SetupLayout() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed-out') return <Redirect href="/sign-in" />;
  // Keep iOS edge-swipe enabled so Welcome can map it to the previous step (DESIGN Page 4).
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }} />;
}
