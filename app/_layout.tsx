import '@/lib/cryptoPolyfill';
import { Inter_300Light, Inter_400Regular, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { config } from '@/config';
import { DesignProvider } from '@/design/ThemeProvider';
import { ToastProvider } from '@/design/components';
import { isRedesignEnabled, useFigtreeFonts } from '@/design/redesign';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { SyncProvider } from '@/data/sync/SyncProvider';
import { ConfigErrorScreen } from '@/features/dev/ConfigErrorScreen';
import { DevMenu } from '@/features/dev/DevMenu';

export default function RootLayout() {
  const [interLoaded] = useFonts({ Inter_300Light, Inter_400Regular });
  const figtreeLoaded = useFigtreeFonts();
  const fontsLoaded = interLoaded && (!isRedesignEnabled() || figtreeLoaded);
  const configBroken = config.appEnv === 'development' && config.problems.length > 0;

  return (
    <SafeAreaProvider>
      <DesignProvider>
        {configBroken ? (
          <ConfigErrorScreen problems={config.problems} />
        ) : !fontsLoaded ? null : (
          <AuthProvider>
            <SyncProvider>
              <ToastProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false }} />
                {config.appEnv === 'development' ? <DevMenu /> : null}
              </ToastProvider>
            </SyncProvider>
          </AuthProvider>
        )}
      </DesignProvider>
    </SafeAreaProvider>
  );
}
