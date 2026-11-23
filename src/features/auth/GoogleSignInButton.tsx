import React, { useEffect, useRef } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Button, useTheme } from '../../design';
import { t } from '../../i18n';
import { Globe } from 'lucide-react-native';

interface GoogleSignInButtonProps {
  clientId: string | null;
  onCredential: (idToken: string) => void;
  mode?: 'signin' | 'signup';
  loading?: boolean;
}

export function GoogleSignInButton({
  clientId,
  onCredential,
  mode = 'signin',
  loading = false,
}: GoogleSignInButtonProps) {
  const { colors } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !clientId || typeof window === 'undefined') return;

    function renderGisButton() {
      if (window.google?.accounts?.id && containerRef.current) {
        containerRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId!,
          callback: (res: { credential?: string }) => {
            if (res.credential) onCredential(res.credential);
          },
          auto_select: false,
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: 320,
        });
      }
    }

    if (window.google?.accounts?.id) {
      renderGisButton();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          renderGisButton();
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [clientId, mode, onCredential]);

  if (Platform.OS === 'web' && clientId) {
    return (
      <View style={styles.container}>
        <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
      </View>
    );
  }

  return (
    <Button
      label={mode === 'signup' ? t('ui.signUpScreen.signUpWithGoogle') : t('ui.signInScreen.continueWithGoogle')}
      onPress={() => undefined}
      variant="secondary"
      icon={<Globe size={18} color={colors.textSecondary} />}
      loading={loading}
      disabled={!clientId || loading}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
