import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Transport } from '@/api/client';
import { createMemorySessionStore, type SessionStore } from '@/data/session';
import { DesignProvider } from '@/design/ThemeProvider';
import { ToastProvider } from '@/design/components';
import { AuthProvider } from '@/features/auth/AuthProvider';

const metrics = { frame: { x: 0, y: 0, width: 375, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export function renderWithProviders(
  ui: ReactElement,
  options: { privacy?: boolean; transport?: Transport; session?: SessionStore; reduceMotion?: boolean } = {},
) {
  const session = options.session ?? createMemorySessionStore();
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DesignProvider initialPrivacy={options.privacy} initialChoice="light" reduceMotionOverride={options.reduceMotion ?? true}>
        <AuthProvider initialSource="mock" transport={options.transport} session={session}>
          <ToastProvider>{ui}</ToastProvider>
        </AuthProvider>
      </DesignProvider>
    </SafeAreaProvider>,
  );
}
