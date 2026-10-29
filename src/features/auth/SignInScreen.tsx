import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { isTwoFactorRequired, securityApi } from '@/api/security';
import { Button, Checkbox, CodeInput, Divider, InlineError, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { AuthFrame } from './AuthFrame';
import { useAuth } from './AuthProvider';
import { GoogleSignInButton } from './GoogleSignInButton';
import { loadGoogleSignIn, peekGoogleLinkPending, runGoogleSignIn, takeGoogleLinkPending } from './googleSignIn';
import { EMAIL_PATTERN } from './password';
import { passkeyAssertion, passkeysAvailable } from './passkey';
import { rememberTrustedDevice, trustedDeviceToken } from './trustedDevice';

type Session = Parameters<ReturnType<typeof useAuth>['completeSignIn']>[0];

export function SignInScreen({ now = () => Date.now() }: { now?: () => number }) {
  const router = useRouter();
  const { api, client, completeSignIn } = useAuth();
  const security = securityApi(client);
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stay, setStay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [showGoogle, setShowGoogle] = useState(false);
  // Two-factor step (DESIGN page 1): the challenge from sign-in, then a code or a backup code.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [trust, setTrust] = useState(false);
  const [passkeyFailed, setPasskeyFailed] = useState(false);

  const secondsLeft = waitUntil ? Math.max(0, Math.ceil((waitUntil - now()) / 1000)) : 0;
  useEffect(() => {
    let alive = true;
    void loadGoogleSignIn(api).then((g) => {
      if (alive) setShowGoogle(g.enabled);
    });
    return () => {
      alive = false;
    };
  }, [api]);
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

  const finishSession = async (res: Session | { twoFactorRequired: true; challengeToken: string }, signedInStay: boolean) => {
    if (isTwoFactorRequired(res)) {
      setChallenge(res.challengeToken);
      setCode('');
      setBackupCode('');
      return;
    }
    await completeSignIn(res, signedInStay);
    router.replace(res.user.setupComplete ? '/' : '/welcome');
  };

  const signedInStay = Platform.OS === 'web' && stay;

  const verify = async (entered = code) => {
    if (!challenge || busy || !online) return;
    setBusy(true);
    setError(null);
    try {
      const res = await security.twoFactorSignIn({
        challengeToken: challenge,
        ...(useBackup ? { backupCode } : { code: entered }),
        trustDevice: trust,
        staySignedIn: signedInStay,
      });
      await rememberTrustedDevice(email, res.trustedDeviceToken);
      const { trustedDeviceToken: _t, ...session } = res;
      await finishSession(session, signedInStay);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setWaitUntil(now() + (e.body.retryAfterSeconds ?? 60) * 1000);
        setError(t('signIn.wait'));
      } else if (e instanceof ApiError && e.body.code === 'challenge_ended') {
        setChallenge(null);
        setError(t('signIn.challengeEnded'));
      } else if (e instanceof ApiError && e.status === 401) {
        setError(useBackup ? t('signIn.backupWrong') : t('signIn.codeWrong'));
      } else {
        setError(t('errors.network'));
      }
    } finally {
      setBusy(false);
    }
  };

  const passkey = async () => {
    if (!online || busy) return;
    setBusy(true);
    setError(null);
    setPasskeyFailed(false);
    try {
      const { challengeToken, options } = await security.passkeySignInOptions();
      const response = await passkeyAssertion(options);
      await finishSession(await security.passkeySignIn({ challengeToken, response, staySignedIn: signedInStay }), signedInStay);
    } catch {
      setPasskeyFailed(true);
    } finally {
      setBusy(false);
    }
  };

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
      const link = peekGoogleLinkPending();
      const googleLinkToken =
        link && link.email.toLowerCase() === email.trim().toLowerCase() ? link.linkToken : undefined;
      const res = await api.signIn({
        email: email.trim(),
        password,
        staySignedIn: signedInStay,
        trustedDeviceToken: await trustedDeviceToken(email),
        ...(googleLinkToken ? { googleLinkToken } : {}),
      });
      if (googleLinkToken) takeGoogleLinkPending();
      await finishSession(res, signedInStay);
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

  const google = async () => {
    if (!online || busy || secondsLeft > 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await runGoogleSignIn(api);
      if (res.ok) await finishSession(res.session, Platform.OS === 'web' && stay);
      else if (res.reason === 'link_password') setError(t('signIn.googleLinkPassword'));
    } finally {
      setBusy(false);
    }
  };

  const disabled = !online || busy || secondsLeft > 0;

  if (challenge) {
    return (
      <AuthFrame>
        <Text variant="display-md" accessibilityRole="header">
          {useBackup ? t('signIn.backupTitle') : t('signIn.twoFactorTitle')}
        </Text>
        <Text tone="textSecondary">{useBackup ? t('signIn.backupBody') : t('signIn.twoFactorBody')}</Text>
        {useBackup ? (
          <TextInput testID="backup-code" label={t('signIn.backupLabel')} value={backupCode} onChangeText={setBackupCode} autoCapitalize="none" onSubmitEditing={() => void verify()} />
        ) : (
          <CodeInput
            testID="two-factor-code"
            value={code}
            onChange={(next) => {
              setCode(next);
              if (next.length === 6) void verify(next);
            }}
          />
        )}
        <Checkbox testID="trust-device" label={t('signIn.trust')} checked={trust} onChange={setTrust} />
        {error ? <InlineError testID="sign-in-error" message={error} /> : null}
        <Button
          testID="verify"
          kind="gradient"
          label={t('signIn.verify')}
          onPress={() => void verify()}
          disabled={disabled || (useBackup ? backupCode.trim().length < 8 : code.length !== 6)}
          fullWidth
        />
        <Button kind="link" label={useBackup ? t('signIn.useCode') : t('signIn.useBackup')} onPress={() => setUseBackup((v) => !v)} />
        <Button kind="link" label={t('signIn.back')} onPress={() => setChallenge(null)} />
      </AuthFrame>
    );
  }

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
      {showGoogle || passkeysAvailable() ? <Divider label={t('auth.or')} /> : null}
      {passkeysAvailable() ? (
        <>
          <Button testID="passkey" kind="secondary" label={t('signIn.passkey')} onPress={passkey} disabled={disabled} fullWidth />
          {passkeyFailed ? (
            <View style={{ gap: tokens.spacing['spacing-xs'] }}>
              <InlineError message={t('signIn.passkeyFailed')} />
              <View style={{ flexDirection: 'row', gap: tokens.spacing['spacing-sm'] }}>
                <Button kind="link" label={t('signIn.tryAgain')} onPress={passkey} />
                <Button kind="link" label={t('signIn.usePassword')} onPress={() => setPasskeyFailed(false)} />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
      {showGoogle ? <GoogleSignInButton onPress={google} disabled={disabled} /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: tokens.spacing['spacing-xs'] }}>
        <Text tone="textSecondary">{t('signIn.newPrompt')}</Text>
        <Button kind="link" label={t('signIn.createOne')} onPress={() => router.push('/sign-up')} />
      </View>
    </AuthFrame>
  );
}
