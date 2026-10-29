import { Redirect, Slot } from 'expo-router';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppLockGate } from '@/features/lock/AppLock';
import { LocalPushBridge } from '@/features/notifications/LocalPushBridge';
import { AddTransactionProvider } from '@/features/transactions/AddTransaction';

export default function AppLayout() {
  const { status, user } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed-out' || !user) return <Redirect href="/sign-in" />;
  if (!user.setupComplete) return <Redirect href="/welcome" />;
  return (
    <WorkspaceProvider workspaceId={user.workspaceId}>
      <AppLockGate>
        <AddTransactionProvider>
          <LocalPushBridge />
          <Slot />
        </AddTransactionProvider>
      </AppLockGate>
    </WorkspaceProvider>
  );
}
