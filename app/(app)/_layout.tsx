import { Redirect, Slot } from 'expo-router';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { AddTransactionProvider } from '@/features/transactions/AddTransaction';

export default function AppLayout() {
  const { status, user } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed-out' || !user) return <Redirect href="/sign-in" />;
  if (!user.setupComplete) return <Redirect href="/welcome" />;
  return (
    <WorkspaceProvider workspaceId={user.workspaceId}>
      <AddTransactionProvider>
        <Slot />
      </AddTransactionProvider>
    </WorkspaceProvider>
  );
}
