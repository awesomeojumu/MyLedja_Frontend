import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SetupLayout() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed-out') return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
