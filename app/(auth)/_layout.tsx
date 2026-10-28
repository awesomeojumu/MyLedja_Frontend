import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';

export default function AuthLayout() {
  const { status, user } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed-in' && user) return <Redirect href={user.setupComplete ? '/' : '/welcome'} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
