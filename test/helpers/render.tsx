import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Transport } from '@/api/client';
import { createMemorySessionStore, type SessionStore } from '@/data/session';
import { DesignProvider } from '@/design/ThemeProvider';
import { ToastProvider } from '@/design/components';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { MockSyncServer } from '@/api/mocks/sync';
import { MemoryKeyValue } from '@/data/kv.shared';
import { LocalStore } from '@/data/sync/LocalStore';
import { SyncEngine } from '@/data/sync/SyncEngine';
import { SyncProvider } from '@/data/sync/SyncProvider';

export function memorySync() {
  const store = new LocalStore(new MemoryKeyValue());
  const server = new MockSyncServer();
  return { store, server, engine: new SyncEngine({ store, transport: server, deviceId: 'test' }) };
}

const metrics = { frame: { x: 0, y: 0, width: 375, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export function renderWithProviders(
  ui: ReactElement,
  options: { privacy?: boolean; transport?: Transport; session?: SessionStore; reduceMotion?: boolean; sync?: ReturnType<typeof memorySync> } = {},
) {
  const session = options.session ?? createMemorySessionStore();
  const sync = options.sync ?? memorySync();
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DesignProvider initialPrivacy={options.privacy} initialChoice="light" reduceMotionOverride={options.reduceMotion ?? true}>
        <AuthProvider initialSource="mock" transport={options.transport} session={session}>
          <SyncProvider value={sync}>
            <ToastProvider>{ui}</ToastProvider>
          </SyncProvider>
        </AuthProvider>
      </DesignProvider>
    </SafeAreaProvider>,
  );
}
