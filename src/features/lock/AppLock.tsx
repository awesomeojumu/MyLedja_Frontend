import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';

import { openKeyValue } from '@/data/kv';
import { Button, Confirm, Text } from '@/design/components';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import tokens from '@/design/tokens.json';
import { useAuth } from '@/features/auth/AuthProvider';
import { t } from '@/i18n';

/** App lock and app-switcher privacy on phones (DESIGN.md 10.3, 10.4; build plan F3.3, G-11). */

const LOCK_AFTER_MS = 5 * 60_000;
let store: ReturnType<typeof openKeyValue> | null = null;
/** Opened on first use, so importing this file doesn't open the phone's database. */
const kv = () => (store ??= openKeyValue('myledja-device'));
const KEYS = { enabled: 'lock:enabled', offered: 'lock:offered', privacy: 'lock:privacyDefault', hideRecents: 'lock:hideInRecents' } as const;

const phone = Platform.OS === 'ios' || Platform.OS === 'android';

async function readFlag(key: string, fallback: boolean) {
  try {
    const v = await kv().get(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
const writeFlag = (key: string, value: boolean) => kv().set([[key, value ? '1' : '0']]);

async function canUseBiometrics() {
  if (!phone) return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

async function applyHideInRecents(hide: boolean) {
  if (Platform.OS !== 'android') return;
  if (hide) await ScreenCapture.preventScreenCaptureAsync('recents');
  else await ScreenCapture.allowScreenCaptureAsync('recents');
}

/** Settings › Security switches for this device. */
export function useAppLockSetting() {
  const [enabled, setEnabledState] = useState(false);
  const [privacyDefault, setPrivacyState] = useState(false);
  const [hideInRecents, setHideState] = useState(false);
  useEffect(() => {
    void (async () => {
      setEnabledState(await readFlag(KEYS.enabled, false));
      setPrivacyState(await readFlag(KEYS.privacy, false));
      setHideState(await readFlag(KEYS.hideRecents, false));
    })();
  }, []);
  return {
    enabled,
    privacyDefault,
    hideInRecents,
    setEnabled: async (on: boolean) => {
      // Turning it on proves the face or fingerprint works first.
      if (on) {
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('lock.prompt') });
        if (!res.success) return;
      }
      await writeFlag(KEYS.enabled, on);
      setEnabledState(on);
    },
    setPrivacyDefault: async (on: boolean) => {
      await writeFlag(KEYS.privacy, on);
      setPrivacyState(on);
    },
    setHideInRecents: async (on: boolean) => {
      await writeFlag(KEYS.hideRecents, on);
      await applyHideInRecents(on);
      setHideState(on);
    },
  };
}

/**
 * Wraps the signed-in app. Reopening after 5 minutes asks for the face or fingerprint; the app switcher shows a
 * plain cover instead of balances; app lock is offered once after the first sign-in.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { status } = useAuth();
  const { setPrivacy } = useDesign();
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const [offer, setOffer] = useState(false);
  const leftAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('lock.prompt') });
    if (res.success) setLocked(false);
  }, []);

  useEffect(() => {
    if (!phone) return;
    void readFlag(KEYS.hideRecents, false).then(applyHideInRecents);
    // "Privacy mode by default": amounts start hidden each time MyLedja opens on this phone.
    void readFlag(KEYS.privacy, false).then((on) => on && setPrivacy(true));
    const sub = AppState.addEventListener('change', (state) => {
      setCovered(state !== 'active');
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current !== null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        void readFlag(KEYS.enabled, false).then((on) => {
          if (on && away >= LOCK_AFTER_MS) {
            setLocked(true);
            void unlock();
          }
        });
      }
    });
    return () => sub.remove();
  }, [unlock, setPrivacy]);

  useEffect(() => {
    if (!phone || status !== 'signed-in') return;
    void (async () => {
      if (await readFlag(KEYS.offered, false)) return;
      if (!(await canUseBiometrics())) return;
      await writeFlag(KEYS.offered, true);
      setOffer(true);
    })();
  }, [status]);

  const cover = locked || covered;
  return (
    <View style={{ flex: 1 }}>
      {children}
      {cover ? (
        <View
          testID="app-lock-cover"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.page,
            alignItems: 'center',
            justifyContent: 'center',
            gap: tokens.spacing['spacing-md'],
          }}
        >
          <Text variant="display-md">{t('app.name')}</Text>
          {locked ? <Button label={t('lock.unlock')} onPress={() => void unlock()} /> : null}
        </View>
      ) : null}
      <Confirm
        visible={offer}
        title={t('lock.offerTitle')}
        body={t('lock.offerBody')}
        confirmLabel={t('lock.offerConfirm')}
        onConfirm={() => {
          setOffer(false);
          void writeFlag(KEYS.enabled, true);
        }}
        onCancel={() => setOffer(false)}
      />
    </View>
  );
}
