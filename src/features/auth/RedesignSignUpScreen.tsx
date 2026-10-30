import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ApiError } from '@/api/client';
import type { SessionResponse } from '@/api/auth';
import { isTwoFactorRequired } from '@/api/security';
import {
  RedesignAuthFrame,
  RedesignButton,
  RedesignCodeInput,
  RedesignDividerLabel,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignSheet,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t, type TextKey } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { useAuth } from './AuthProvider';
import { loadGoogleSignIn, runGoogleSignIn } from './googleSignIn';
import { checkPassword, EMAIL_PATTERN } from './password';

const RESEND_SECONDS = 45;
const sp = tokens.space;
const size = tokens.size;

function GoogleMark({ size: mark = 18 }: { size?: number }) {
  return (
    <Svg width={mark} height={mark} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="sign-up-back"
      accessibilityRole="link"
      accessibilityLabel={t('common.back')}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp.xs,
        alignSelf: 'flex-start',
        minHeight: tokens.density.touch.minTarget,
        marginLeft: -sp.sm,
        paddingHorizontal: sp.sm,
      }}
    >
      <RedesignIcon name="arrow-left" size={size['icon-md']} color={theme.primary} />
      <RedesignText tone="primary">{t('common.back')}</RedesignText>
    </Pressable>
  );
}

function PasswordRules({ password }: { password: string }) {
  const { rules } = checkPassword(password);
  const rows: [boolean, TextKey][] = [
    [rules.length, 'signUp.redesign.rule.length'],
    [rules.mixed, 'signUp.redesign.rule.mixed'],
    [rules.common, 'signUp.redesign.rule.common'],
  ];
  return (
    <View testID="password-rules" style={{ gap: sp.sm }}>
      {rows.map(([met, key]) => (
        <View key={key} style={{ flexDirection: 'row', gap: sp.sm, alignItems: 'center' }}>
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: met ? theme.primary : theme.borderStrong,
              backgroundColor: met ? theme.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {met ? <RedesignIcon name="check" size={10} color={theme.textOnPrimary} /> : null}
          </View>
          <RedesignText variant="helper" tone={met ? 'text' : 'textSecondary'}>
            {t(key)}
          </RedesignText>
        </View>
      ))}
    </View>
  );
}

function TermsLine({ onTerms, onPrivacy }: { onTerms: () => void; onPrivacy: () => void }) {
  const parts = t('signUp.redesign.terms', { terms: '\u0000', privacy: '\u0001' }).split(/(\u0000|\u0001)/);
  return (
    <RedesignText variant="helper" tone="textSecondary" style={{ textAlign: 'center' }}>
      {parts.map((part, i) => {
        if (part === '\u0000') {
          return (
            <RedesignText
              key={i}
              variant="helper"
              tone="primary"
              accessibilityRole="link"
              onPress={onTerms}
              style={{ textDecorationLine: 'underline' }}
            >
              {t('signUp.termsLink')}
            </RedesignText>
          );
        }
        if (part === '\u0001') {
          return (
            <RedesignText
              key={i}
              variant="helper"
              tone="primary"
              accessibilityRole="link"
              onPress={onPrivacy}
              style={{ textDecorationLine: 'underline' }}
            >
              {t('signUp.redesign.privacyLink')}
            </RedesignText>
          );
        }
        return part;
      })}
    </RedesignText>
  );
}

/**
 * Progressive Sign up (Figma Auth Phone 3:591 / 3:691 / 3:785 / 3:849).
 * Details → password → verify email → created; Google on details below the divider.
 */
export function RedesignSignUpScreen() {
  const router = useRouter();
  const { api, completeSignIn } = useAuth();
  const online = useOnline();
  const [step, setStep] = useState<'details' | 'password' | 'code' | 'done'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reading, setReading] = useState<'terms' | 'privacy' | null>(null);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'password' | 'form', string>>>({});
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resentNote, setResentNote] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

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
    if (step !== 'code' || resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [step, resendIn]);

  const detailsReady = name.trim().length > 0 && EMAIL_PATTERN.test(email.trim());
  const passwordReady = checkPassword(password).ok;
  const disabled = !online || busy;

  const goDetailsContinue = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('errors.nameRequired');
    if (!EMAIL_PATTERN.test(email.trim())) next.email = t('errors.emailInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    setStep('password');
  };

  const create = async () => {
    if (!passwordReady) {
      setErrors({ password: t('errors.passwordWeak') });
      return;
    }
    if (!online) return;
    setBusy(true);
    setErrors({});
    try {
      const sent = await api.signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        termsAccepted: true,
      });
      setStep('code');
      setCode('');
      setCodeError(null);
      setResentNote(null);
      setResendIn(sent?.resendAfterSeconds ?? RESEND_SECONDS);
    } catch (e) {
      setErrors({ form: e instanceof ApiError ? e.body.message : t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

  const verify = async (entered = code) => {
    if (entered.length !== 6) {
      setCodeError(t('errors.codeIncomplete'));
      return;
    }
    if (!online || busy) return;
    setBusy(true);
    setCodeError(null);
    try {
      const res = await api.verifyEmail({ email: email.trim(), code: entered });
      setSession(res);
      setStep('done');
    } catch (e) {
      setCodeError(e instanceof ApiError && e.status === 400 ? t('errors.codeInvalid') : t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0 || !online || busy) return;
    try {
      const sent = await api.resendCode({ email: email.trim(), purpose: 'sign_up' });
      setResendIn(sent?.resendAfterSeconds ?? RESEND_SECONDS);
      setResentNote(t('signUp.resent'));
      setCodeError(null);
    } catch {
      setCodeError(t('errors.network'));
    }
  };

  const google = async () => {
    if (!online || busy) return;
    setBusy(true);
    setErrors({});
    try {
      const res = await runGoogleSignIn(api);
      if (res.ok) {
        if (isTwoFactorRequired(res.session)) {
          router.replace('/sign-in');
        } else {
          await completeSignIn(res.session, false);
          router.replace('/welcome');
        }
      } else if (res.reason === 'link_password') {
        setErrors({ form: t('signIn.googleLinkPassword') });
        router.replace('/sign-in');
      } else if (res.reason === 'cancelled') {
        /* person closed the Google sheet */
      } else {
        setErrors({ form: res.message ?? t('errors.network') });
      }
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode = null;

  if (step === 'done') {
    body = (
      <View testID="redesign-sign-up-done" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('signUp.redesign.readyTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('signUp.redesign.readyBody')}</RedesignText>
        </View>
        <RedesignButton
          testID="ready-continue"
          kind="primary"
          label={t('common.continue')}
          fullWidth
          onPress={async () => {
            if (session) await completeSignIn(session, false);
            router.replace('/welcome');
          }}
        />
      </View>
    );
  } else if (step === 'code') {
    body = (
      <View testID="redesign-sign-up-code" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <BackLink onPress={() => setStep('password')} />
          <RedesignText variant="title" accessibilityRole="header">
            {t('signUp.checkTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('signUp.redesign.checkBody', { email: email.trim() })}</RedesignText>
        </View>
        <RedesignCodeInput
          testID="code"
          value={code}
          onChange={(v) => {
            setCode(v);
            setCodeError(null);
            if (v.length === 6) void verify(v);
          }}
        />
        {codeError ? <RedesignInlineError message={codeError} /> : null}
        {resentNote ? (
          <RedesignText variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
            {resentNote}
          </RedesignText>
        ) : null}
        <RedesignButton
          testID="verify"
          kind={code.length === 6 ? 'primary' : 'soft'}
          label={t('signUp.redesign.verify')}
          onPress={() => void verify()}
          disabled={disabled || code.length !== 6}
          fullWidth
        />
        <View style={{ gap: sp.xs }}>
          {resendIn > 0 ? (
            <RedesignText variant="caption" tone="textSecondary" testID="resend-countdown" accessibilityLiveRegion="polite">
              {t('signUp.resendIn', { seconds: String(resendIn).padStart(2, '0') })}
            </RedesignText>
          ) : null}
          <RedesignButton
            testID="resend"
            kind="link"
            label={t('signUp.resend')}
            onPress={() => void resend()}
            disabled={disabled || resendIn > 0}
            accessibilityRole="link"
          />
        </View>
      </View>
    );
  } else if (step === 'password') {
    body = (
      <View testID="redesign-sign-up-password" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <BackLink onPress={() => setStep('details')} />
          <RedesignText variant="title" accessibilityRole="header">
            {t('signUp.redesign.passwordTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('signUp.redesign.passwordBody')}</RedesignText>
        </View>
        <RedesignField
          testID="password"
          label={t('auth.password')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setErrors((e) => ({ ...e, password: undefined, form: undefined }));
          }}
          placeholder={t('signUp.redesign.passwordPlaceholder')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
          onSubmitEditing={() => void create()}
          autoFocus
        />
        <PasswordRules password={password} />
        <TermsLine onTerms={() => setReading('terms')} onPrivacy={() => setReading('privacy')} />
        {errors.form ? <RedesignInlineError message={errors.form} /> : null}
        <RedesignButton
          testID="create"
          kind={passwordReady ? 'primary' : 'soft'}
          label={t('signUp.submit')}
          onPress={() => void create()}
          disabled={disabled || !passwordReady}
          fullWidth
        />
      </View>
    );
  } else {
    body = (
      <View testID="redesign-sign-up" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header">
            {t('signUp.redesign.title')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('signUp.redesign.body')}</RedesignText>
        </View>
        <RedesignField
          testID="name"
          label={t('signUp.name')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setErrors((e) => ({ ...e, name: undefined }));
          }}
          placeholder={t('signUp.redesign.namePlaceholder')}
          autoComplete="name"
          textContentType="name"
          error={errors.name}
          autoFocus
        />
        <RedesignField
          testID="email"
          label={t('auth.email')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setErrors((e) => ({ ...e, email: undefined }));
          }}
          placeholder={t('signUp.redesign.emailPlaceholder')}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          error={errors.email}
          onSubmitEditing={goDetailsContinue}
        />
        {errors.form ? <RedesignInlineError message={errors.form} /> : null}
        <RedesignButton
          testID="details-continue"
          kind={detailsReady ? 'primary' : 'soft'}
          label={t('common.continue')}
          onPress={goDetailsContinue}
          disabled={disabled || !detailsReady}
          fullWidth
        />
        {showGoogle ? (
          <>
            <RedesignDividerLabel label={t('auth.or')} />
            <RedesignButton
              testID="google-sign-in"
              kind="secondary"
              label={t('auth.google')}
              onPress={() => void google()}
              disabled={disabled}
              fullWidth
              leading={<GoogleMark />}
            />
          </>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: sp.xs,
          }}
        >
          <RedesignText tone="textSecondary">{t('signUp.redesign.haveAccount')}</RedesignText>
          <RedesignButton
            kind="link"
            label={t('signUp.signIn')}
            onPress={() => router.push('/sign-in')}
            accessibilityRole="link"
          />
        </View>
      </View>
    );
  }

  return (
    <RedesignAuthFrame>
      {body}
      <RedesignSheet
        visible={reading !== null}
        title={reading === 'privacy' ? t('signUp.privacyTitle') : t('signUp.termsTitle')}
        onClose={() => setReading(null)}
        testID="reading-sheet"
      >
        <RedesignText testID="reading-body">
          {reading === 'privacy' ? t('signUp.privacyBody') : t('signUp.termsBody')}
        </RedesignText>
      </RedesignSheet>
    </RedesignAuthFrame>
  );
}
