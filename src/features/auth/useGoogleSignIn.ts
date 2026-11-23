import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { authApi } from '../../api/auth';
import type { ApiClient } from '../../api/client';
import { t } from '../../i18n';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

interface UseGoogleSignInOptions {
  client: ApiClient;
  onSuccess: (credential: string) => void | Promise<void>;
  onError: (errorText: string) => void;
}

export function useGoogleSignIn({ client, onSuccess, onError }: UseGoogleSignInOptions) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    let active = true;
    void authApi(client)
      .publicConfig()
      .then((cfg) => {
        if (active && cfg.google?.enabled && cfg.google.clientId) {
          setClientId(cfg.google.clientId);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client]);

  const handleCredentialResponse = useCallback(
    (response: { credential?: string }) => {
      if (!response.credential) {
        onError(t('errors.generic'));
        return;
      }
      void onSuccess(response.credential);
    },
    [onSuccess, onError],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !clientId || typeof window === 'undefined') return;

    function initGoogle() {
      if (window.google?.accounts?.id && !initialized.current) {
        window.google.accounts.id.initialize({
          client_id: clientId!,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        initialized.current = true;
        setIsReady(true);
      }
    }

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogle();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [clientId, handleCredentialResponse]);

  const promptSignIn = useCallback(() => {
    if (Platform.OS !== 'web') {
      onError(t('signIn.googleUnavailable'));
      return;
    }
    if (!clientId) {
      onError(t('signIn.googleUnavailable'));
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback if One Tap prompt was suppressed or closed
        }
      });
    } else {
      onError(t('signIn.googleUnavailable'));
    }
  }, [clientId, onError]);

  return { isReady, promptSignIn, clientId };
}
