import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { Button, Checkbox, InlineError, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { AuthFrame } from './AuthFrame';
import { useAuth } from './AuthProvider';
import { EMAIL_PATTERN } from './password';

export function SignInScreen({ now = () => Date.now() }: { now?: () => number }) {
  const router = useRouter();
  const { api, completeSignIn } = useAuth();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stay, setStay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const secondsLeft = waitUntil ? Math.max(0, Math.ceil((waitUntil - now()) / 1000)) : 0;
  useEffect(() => {
    if (!waitUntil) return;
    const id = setInterval(() => {
      if (now() >= waitUntil) {
        setWaitUntil(null);
        setError(null);
      }
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [waitUntil, now]);

  const submit = async () => {
    if (!online || busy || secondsLeft > 0) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError(t('errors.emailInvalid'));
      return;
    }
    setEmailError(null);
    setBusy(true);
    setError(null);
    try {
      const res = await api.signIn({ email: email.trim(), password, staySignedIn: Platform.OS === 'web' && stay });
      await completeSignIn(res, Platform.OS === 'web' && stay);
      router.replace(res.user.setupComplete ? '/' : '/welcome');
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setWaitUntil(now() + (e.body.retryAfterSeconds ?? 60) * 1000);
        setError(t('signIn.wait'));
      } else if (e instanceof ApiError && e.status === 401) {
        setError(t('signIn.wrong'));
      } else {
        setError(t('errors.network'));
      }
    } finally {
      setBusy(false);
    }
  };

  const disabled = !online || busy || secondsLeft > 0;
  return (
    <AuthFrame>
      <Text variant="display-md" accessibilityRole="header">
        {t('signIn.title')}
      </Text>
      <TextInput
        testID="email"
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        keyboardType="email-address"
        error={emailError}
        autoFocus
      />
      <View style={{ gap: tokens.spacing['spacing-xs'] }}>
        <TextInput
          testID="password"
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        <View style={{ alignItems: 'flex-end' }}>
          <Button kind="link" label={t('signIn.forgot')} onPress={() => router.push('/recover')} />
        </View>
      </View>
      {Platform.OS === 'web' ? (
        <Checkbox testID="stay" label={t('signIn.stay')} checked={stay} onChange={setStay} caption={t('signIn.stayCaption')} />
      ) : null}
      {error ? <InlineError testID="sign-in-error" message={error} /> : null}
      {secondsLeft > 0 ? (
        <Text variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
          {t('signIn.waitCountdown', { seconds: secondsLeft })}
        </Text>
      ) : null}
      <Button testID="sign-in" kind="gradient" label={t('signIn.submit')} onPress={submit} disabled={disabled} fullWidth />
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: tokens.spacing['spacing-xs'] }}>
        <Text tone="textSecondary">{t('signIn.newPrompt')}</Text>
        <Button kind="link" label={t('signIn.createOne')} onPress={() => router.push('/sign-up')} />
      </View>
    </AuthFrame>
  );
}
