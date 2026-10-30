import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import {
  RedesignAuthFrame,
  RedesignButton,
  RedesignCodeInput,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t, type TextKey } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { useAuth } from './AuthProvider';
import { checkPassword, EMAIL_PATTERN } from './password';

const RESEND_SECONDS = 45;
const sp = tokens.space;
const size = tokens.size;

function BackLink({ onPress, testID = 'recover-back' }: { onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
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

/**
 * Progressive Recover (Figma Auth Phone 3:880 / 3:957 / 3:1043 / 3:1117).
 * Email → code → new password → done. Tablet/Web card via RedesignAuthFrame.
 */
export function RedesignRecoverScreen({ now = () => Date.now() }: { now?: () => number }) {
  const router = useRouter();
  const { api } = useAuth();
  const online = useOnline();
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'email' | 'code' | 'password' | 'form', string>>>({});
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resentNote, setResentNote] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const secondsLeft = waitUntil ? Math.max(0, Math.ceil((waitUntil - now()) / 1000)) : 0;
  const emailReady = EMAIL_PATTERN.test(email.trim());
  const passwordReady = checkPassword(password).ok;
  const disabled = !online || busy || secondsLeft > 0;

  useEffect(() => {
    if (!waitUntil) return;
    const id = setInterval(() => {
      if (now() >= waitUntil) {
        setWaitUntil(null);
        setErrors((e) => (e.form === t('signIn.wait') ? { ...e, form: undefined } : e));
      }
      setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [waitUntil, now]);

  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [step, resendIn]);

  const applyRateLimit = (e: unknown) => {
    if (e instanceof ApiError && e.status === 429) {
      setWaitUntil(now() + (e.body.retryAfterSeconds ?? 60) * 1000);
      setErrors({ form: t('signIn.wait') });
      return true;
    }
    return false;
  };

  const send = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setErrors({ email: t('errors.emailInvalid') });
      return;
    }
    if (!online || busy || secondsLeft > 0) return;
    setBusy(true);
    setErrors({});
    try {
      const sent = await api.recover({ email: email.trim() });
      setCode('');
      setResentNote(null);
      setResendIn(sent?.resendAfterSeconds ?? RESEND_SECONDS);
      setStep('code');
    } catch (e) {
      if (!applyRateLimit(e)) setErrors({ form: t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

  const goPassword = (entered = code) => {
    if (entered.length !== 6) {
      setErrors({ code: t('errors.codeIncomplete') });
      return;
    }
    setErrors({});
    setStep('password');
  };

  const resend = async () => {
    if (resendIn > 0 || !online || busy || secondsLeft > 0) return;
    try {
      const sent = await api.resendCode({ email: email.trim(), purpose: 'recover' });
      setResendIn(sent?.resendAfterSeconds ?? RESEND_SECONDS);
      setResentNote(t('signUp.resent'));
      setErrors((e) => ({ ...e, code: undefined, form: undefined }));
    } catch (e) {
      if (!applyRateLimit(e)) setErrors({ form: t('errors.network') });
    }
  };

  const save = async () => {
    if (busy || secondsLeft > 0) return;
    if (!checkPassword(password).ok) {
      setErrors({ password: t('errors.passwordWeak') });
      return;
    }
    if (code.length !== 6) {
      setErrors({ code: t('errors.codeIncomplete') });
      setStep('code');
      return;
    }
    if (!online) return;
    setBusy(true);
    setErrors({});
    try {
      await api.newPassword({ email: email.trim(), code, newPassword: password });
      setStep('done');
    } catch (e) {
      if (applyRateLimit(e)) {
        /* wait copy set */
      } else if (e instanceof ApiError && e.status === 400) {
        setErrors({ code: t('errors.codeInvalid') });
        setStep('code');
      } else {
        setErrors({ form: t('errors.network') });
      }
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode = null;

  if (step === 'done') {
    body = (
      <View testID="redesign-recover-done" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="title" accessibilityRole="header" testID="recover-done">
            {t('recover.redesign.doneTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('recover.redesign.doneBody')}</RedesignText>
        </View>
        <RedesignButton
          testID="to-sign-in"
          kind="primary"
          label={t('recover.redesign.toSignIn')}
          fullWidth
          onPress={() => router.replace('/sign-in')}
        />
      </View>
    );
  } else if (step === 'password') {
    body = (
      <View testID="redesign-recover-password" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <BackLink onPress={() => setStep('code')} />
          <RedesignText variant="title" accessibilityRole="header">
            {t('recover.redesign.passwordTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('recover.redesign.passwordBody')}</RedesignText>
        </View>
        <RedesignField
          testID="new-password"
          label={t('recover.redesign.newPassword')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setErrors((e) => ({ ...e, password: undefined, form: undefined }));
          }}
          placeholder={t('recover.redesign.passwordPlaceholder')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
          onSubmitEditing={() => void save()}
          autoFocus
        />
        <PasswordRules password={password} />
        {errors.form ? (
          <View testID="recover-error">
            <RedesignInlineError message={errors.form} />
          </View>
        ) : null}
        {secondsLeft > 0 ? (
          <RedesignText variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
            {t('signIn.waitCountdown', { seconds: secondsLeft })}
          </RedesignText>
        ) : null}
        <RedesignButton
          testID="save-password"
          kind={passwordReady ? 'primary' : 'soft'}
          label={t('recover.redesign.save')}
          onPress={() => void save()}
          disabled={disabled || !passwordReady}
          fullWidth
        />
      </View>
    );
  } else if (step === 'code') {
    body = (
      <View testID="redesign-recover-code" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <BackLink onPress={() => setStep('email')} />
          <RedesignText variant="title" accessibilityRole="header">
            {t('recover.redesign.checkTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary">
            {t('recover.redesign.checkBody', { email: email.trim() })}
          </RedesignText>
        </View>
        <RedesignCodeInput
          testID="code"
          value={code}
          onChange={(v) => {
            setCode(v);
            setErrors((e) => ({ ...e, code: undefined }));
            if (v.length === 6) goPassword(v);
          }}
        />
        {errors.code ? <RedesignInlineError message={errors.code} /> : null}
        {errors.form ? (
          <View testID="recover-error">
            <RedesignInlineError message={errors.form} />
          </View>
        ) : null}
        {resentNote ? (
          <RedesignText variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
            {resentNote}
          </RedesignText>
        ) : null}
        {secondsLeft > 0 ? (
          <RedesignText variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
            {t('signIn.waitCountdown', { seconds: secondsLeft })}
          </RedesignText>
        ) : null}
        <RedesignButton
          testID="verify-code"
          kind={code.length === 6 ? 'primary' : 'soft'}
          label={t('recover.redesign.verify')}
          onPress={() => goPassword()}
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
            label={t('recover.redesign.resend')}
            onPress={() => void resend()}
            disabled={disabled || resendIn > 0}
            accessibilityRole="link"
          />
        </View>
      </View>
    );
  } else {
    body = (
      <View testID="redesign-recover" style={{ gap: sp.xl }}>
        <View style={{ gap: sp.sm }}>
          <BackLink onPress={() => router.replace('/sign-in')} />
          <RedesignText variant="title" accessibilityRole="header">
            {t('recover.redesign.title')}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('recover.redesign.body')}</RedesignText>
        </View>
        <RedesignField
          testID="email"
          label={t('auth.email')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setErrors((e) => ({ ...e, email: undefined, form: undefined }));
          }}
          placeholder={t('recover.redesign.emailPlaceholder')}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          error={errors.email}
          onSubmitEditing={() => void send()}
          autoFocus
        />
        {errors.form ? (
          <View testID="recover-error">
            <RedesignInlineError message={errors.form} />
          </View>
        ) : null}
        {secondsLeft > 0 ? (
          <RedesignText variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
            {t('signIn.waitCountdown', { seconds: secondsLeft })}
          </RedesignText>
        ) : null}
        <RedesignButton
          testID="send-code"
          kind={emailReady ? 'primary' : 'soft'}
          label={t('recover.redesign.submit')}
          onPress={() => void send()}
          disabled={disabled || !emailReady}
          fullWidth
        />
      </View>
    );
  }

  return <RedesignAuthFrame>{body}</RedesignAuthFrame>;
}
