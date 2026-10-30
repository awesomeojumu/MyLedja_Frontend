import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ApiError } from '@/api/client';
import { isTwoFactorRequired, securityApi } from '@/api/security';
import {
  RedesignAuthFrame,
  RedesignButton,
  RedesignCheckbox,
  RedesignCodeInput,
  RedesignDividerLabel,
  RedesignField,
  RedesignInlineError,
  RedesignText,
} from '@/design/redesign';
import { redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { useAuth } from './AuthProvider';
import { loadGoogleSignIn, peekGoogleLinkPending, runGoogleSignIn, takeGoogleLinkPending } from './googleSignIn';
import { EMAIL_PATTERN } from './password';
import { passkeyAssertion, passkeysAvailable } from './passkey';
import { rememberTrustedDevice, trustedDeviceToken } from './trustedDevice';

type Session = Parameters<ReturnType<typeof useAuth>['completeSignIn']>[0];

const sp = tokens.space;

function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/**
 * Progressive Sign in (Figma Auth Phone 3:278 / 3:336 / 3:398 / 3:460 / 3:493).
 * Email first, then password, then Continue; Google below the divider.
 */
export function RedesignSignInScreen({ now = () => Date.now() }: { now?: () => number }) {
  const router = useRouter();
  const { api, client, completeSignIn } = useAuth();
  const security = securityApi(client);
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stay, setStay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [showGoogle, setShowGoogle] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [trust, setTrust] = useState(false);
  const [passkeyFailed, setPasskeyFailed] = useState(false);

  const secondsLeft = waitUntil ? Math.max(0, Math.ceil((waitUntil - now()) / 1000)) : 0;
  const showPassword = email.trim().length > 0;
  const showContinue = showPassword && password.length > 0;

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
      setPasswordError(null);
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
    setPasswordError(null);
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
        setPasswordError(t('signIn.redesign.wrong'));
      } else if (e instanceof ApiError && e.status === 403 && e.body.code === 'email_not_verified') {
        setError(t('signIn.emailNotVerified'));
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
      const res = await runGoogleSignIn(api, {
        staySignedIn: signedInStay,
        trustedDeviceToken: await trustedDeviceToken(email),
      });
      if (res.ok) await finishSession(res.session, Platform.OS === 'web' && stay);
      else if (res.reason === 'link_password') {
        if (res.email) setEmail(res.email);
        setError(t('signIn.googleLinkPassword'));
      } else if (res.reason === 'cancelled') {
        /* person closed the Google sheet */
      } else if (res.reason === 'unavailable') {
        setError(res.message ?? t('signIn.googleUnavailable'));
      } else if (res.reason === 'network') {
        setError(res.message ?? t('errors.network'));
      }
    } finally {
      setBusy(false);
    }
  };

  const disabled = !online || busy || secondsLeft > 0;

  if (challenge) {
    return (
      <RedesignAuthFrame>
        <View testID="redesign-sign-in-code" style={{ gap: sp.xl }}>
          <View style={{ gap: sp.sm }}>
            <RedesignButton
              kind="link"
              label={t('common.back')}
              onPress={() => setChallenge(null)}
              accessibilityRole="link"
            />
            <RedesignText variant="title" accessibilityRole="header">
              {useBackup ? t('signIn.backupTitle') : t('signIn.redesign.codeTitle')}
            </RedesignText>
            <RedesignText tone="textSecondary">
              {useBackup ? t('signIn.backupBody') : t('signIn.redesign.codeBody')}
            </RedesignText>
          </View>
          {useBackup ? (
            <RedesignField
              testID="backup-code"
              label={t('signIn.backupLabel')}
              value={backupCode}
              onChangeText={setBackupCode}
              autoCapitalize="none"
              onSubmitEditing={() => void verify()}
            />
          ) : (
            <RedesignCodeInput
              testID="two-factor-code"
              value={code}
              onChange={(next) => {
                setCode(next);
                if (next.length === 6) void verify(next);
              }}
            />
          )}
          <RedesignCheckbox testID="trust-device" label={t('signIn.trust')} checked={trust} onChange={setTrust} />
          {error ? <RedesignInlineError message={error} /> : null}
          <RedesignButton
            testID="verify"
            kind={useBackup ? (backupCode.trim().length >= 8 ? 'primary' : 'soft') : code.length === 6 ? 'primary' : 'soft'}
            label={t('signIn.verify')}
            onPress={() => void verify()}
            disabled={disabled || (useBackup ? backupCode.trim().length < 8 : code.length !== 6)}
            fullWidth
          />
          <RedesignButton
            kind="link"
            label={useBackup ? t('signIn.useCode') : t('signIn.useBackup')}
            onPress={() => setUseBackup((v) => !v)}
            accessibilityRole="link"
          />
        </View>
      </RedesignAuthFrame>
    );
  }

  return (
    <RedesignAuthFrame>
      <View testID="redesign-sign-in" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('signIn.redesign.title')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('signIn.redesign.body')}</RedesignText>
        </View>

        <RedesignField
          testID="email"
          label={t('auth.email')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setEmailError(null);
            setPasswordError(null);
          }}
          placeholder={t('signIn.redesign.emailPlaceholder')}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          error={emailError}
          autoFocus
        />

        {showPassword ? (
          <View style={{ gap: sp.sm }}>
            <RedesignField
              testID="password"
              label={t('auth.password')}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setPasswordError(null);
              }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => void submit()}
              error={passwordError}
            />
            <View style={{ alignItems: 'flex-start' }}>
              <RedesignButton
                kind="link"
                label={t('signIn.redesign.forgot')}
                onPress={() => router.push('/recover')}
                accessibilityRole="link"
              />
            </View>
          </View>
        ) : null}

        {Platform.OS === 'web' && showPassword ? (
          <RedesignCheckbox
            testID="stay"
            label={t('signIn.stay')}
            checked={stay}
            onChange={setStay}
            caption={t('signIn.redesign.stayCaption')}
          />
        ) : null}

        {error ? <RedesignInlineError message={error} /> : null}
        {error === t('signIn.emailNotVerified') ? (
          <RedesignButton kind="link" label={t('signIn.finishSignUp')} onPress={() => router.push('/sign-up')} accessibilityRole="link" />
        ) : null}
        {secondsLeft > 0 ? (
          <RedesignText variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
            {t('signIn.waitCountdown', { seconds: secondsLeft })}
          </RedesignText>
        ) : null}

        {showContinue ? (
          <RedesignButton
            testID="sign-in"
            kind="primary"
            label={t('common.continue')}
            onPress={() => void submit()}
            disabled={disabled}
            fullWidth
          />
        ) : null}

        {showGoogle || passkeysAvailable() ? <RedesignDividerLabel label={t('auth.or')} /> : null}

        {passkeysAvailable() ? (
          <>
            <RedesignButton
              testID="passkey"
              kind="secondary"
              label={t('signIn.passkey')}
              onPress={() => void passkey()}
              disabled={disabled}
              fullWidth
            />
            {passkeyFailed ? (
              <View style={{ gap: sp.xs }}>
                <RedesignInlineError message={t('signIn.passkeyFailed')} />
                <View style={{ flexDirection: 'row', gap: sp.sm }}>
                  <RedesignButton kind="link" label={t('signIn.tryAgain')} onPress={() => void passkey()} accessibilityRole="link" />
                  <RedesignButton kind="link" label={t('signIn.usePassword')} onPress={() => setPasskeyFailed(false)} accessibilityRole="link" />
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {showGoogle ? (
          <RedesignButton
            testID="google-sign-in"
            kind="secondary"
            label={t('auth.google')}
            onPress={() => void google()}
            disabled={disabled}
            fullWidth
            leading={<GoogleMark />}
          />
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs }}>
          <RedesignText tone="textSecondary">{t('signIn.redesign.newPrompt')}</RedesignText>
          <RedesignButton
            kind="link"
            label={t('signIn.redesign.createOne')}
            onPress={() => router.push('/sign-up')}
            accessibilityRole="link"
          />
        </View>
      </View>
    </RedesignAuthFrame>
  );
}
