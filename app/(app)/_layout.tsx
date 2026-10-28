import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';

export default function AppLayout() {
  const { status, user } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed-out' || !user) return <Redirect href="/sign-in" />;
  if (!user.setupComplete) return <Redirect href="/welcome" />;
  return <Slot />;
}
