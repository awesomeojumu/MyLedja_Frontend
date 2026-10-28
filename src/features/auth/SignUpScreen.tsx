import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import type { SessionResponse } from '@/api/auth';
import { Button, Checkbox, CodeInput, InlineError, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { AuthFrame } from './AuthFrame';
import { useAuth } from './AuthProvider';
import { checkPassword, EMAIL_PATTERN } from './password';
import { PasswordStrength } from './PasswordStrength';

const RESEND_SECONDS = 45;

export function SignUpScreen() {
  const router = useRouter();
  const toast = useToast();
  const { api, completeSignIn } = useAuth();
  const online = useOnline();
  const [step, setStep] = useState<'create' | 'code' | 'done'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [reading, setReading] = useState<'terms' | 'privacy' | null>(null);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'password' | 'terms' | 'form', string>>>({});
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [step, resendIn]);

  const create = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('errors.nameRequired');
    if (!EMAIL_PATTERN.test(email.trim())) next.email = t('errors.emailInvalid');
    if (!checkPassword(password).ok) next.password = t('errors.passwordWeak');
    if (!terms) next.terms = t('errors.termsRequired');
    setErrors(next);
    if (Object.keys(next).length || !online) return;
    setBusy(true);
    try {
      const sent = await api.signUp({ name: name.trim(), email: email.trim(), password, termsAccepted: true });
      setStep('code');
      setResendIn(sent?.resendAfterSeconds ?? RESEND_SECONDS);
    } catch (e) {
      setErrors({ form: e instanceof ApiError ? e.body.message : t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setCodeError(t('errors.codeIncomplete'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.verifyEmail({ email: email.trim(), code });
      setSession(res);
      setStep('done');
    } catch (e) {
      setCodeError(e instanceof ApiError && e.status === 400 ? t('errors.codeInvalid') : t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const sent = await api.resendCode({ email: email.trim(), purpose: 'sign_up' });
      setResendIn(sent?.resendAfterSeconds ?? RESEND_SECONDS);
      toast.show(t('signUp.resent'));
    } catch {
      setCodeError(t('errors.network'));
    }
  };

  if (step === 'done') {
    return (
      <AuthFrame>
        <Text variant="display-md" accessibilityRole="header">
          {t('signUp.readyTitle')}
        </Text>
        <Button
          testID="ready-continue"
          kind="gradient"
          label={t('signUp.readyContinue')}
          fullWidth
          onPress={async () => {
            if (session) await completeSignIn(session, false);
            router.replace('/welcome');
          }}
        />
      </AuthFrame>
    );
  }

  if (step === 'code') {
    return (
      <AuthFrame>
        <Text variant="display-md" accessibilityRole="header">
          {t('signUp.checkTitle')}
        </Text>
        <Text tone="textSecondary">{t('signUp.checkBody', { email: email.trim() })}</Text>
        <CodeInput value={code} onChange={(v) => { setCode(v); setCodeError(null); }} error={codeError} />
        <Button testID="verify" kind="gradient" label={t('signUp.verify')} onPress={verify} disabled={busy || !online} fullWidth />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {resendIn > 0 ? (
            <Text variant="caption" tone="textHelper" testID="resend-countdown">
              {t('signUp.resendIn', { seconds: String(resendIn).padStart(2, '0') })}
            </Text>
          ) : (
            <Button kind="link" label={t('signUp.resend')} onPress={resend} />
          )}
          <Button kind="link" label={t('signUp.changeEmail')} onPress={() => { setStep('create'); setCode(''); }} />
        </View>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <Text variant="display-md" accessibilityRole="header">
        {t('signUp.title')}
      </Text>
      <TextInput testID="name" label={t('signUp.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} autoFocus />
      <TextInput
        testID="email"
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        keyboardType="email-address"
        error={errors.email}
      />
      <TextInput
        testID="password"
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.password}
      />
      <PasswordStrength password={password} />
      <View style={{ gap: tokens.spacing['spacing-xs'] }}>
        <Checkbox
          testID="terms"
          checked={terms}
          onChange={setTerms}
          label={
            <Text style={{ flexShrink: 1 }}>
              {t('signUp.terms', { terms: '\u0000', privacy: '\u0001' })
                .split(/(\u0000|\u0001)/)
                .map((part, i) =>
                  part === '\u0000' ? (
                    <Text key={i} tone="link" accessibilityRole="link" onPress={() => setReading('terms')}>
                      {t('signUp.termsLink')}
                    </Text>
                  ) : part === '\u0001' ? (
                    <Text key={i} tone="link" accessibilityRole="link" onPress={() => setReading('privacy')}>
                      {t('signUp.privacyLink')}
                    </Text>
                  ) : (
                    part
                  ),
                )}
            </Text>
          }
        />
        {errors.terms ? <InlineError testID="terms-error" message={errors.terms} /> : null}
      </View>
      {errors.form ? <InlineError message={errors.form} /> : null}
      <Button testID="create" kind="gradient" label={t('signUp.submit')} onPress={create} disabled={busy || !online} fullWidth />
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: tokens.spacing['spacing-xs'] }}>
        <Text tone="textSecondary">{t('signUp.haveAccount')}</Text>
        <Button kind="link" label={t('signUp.signIn')} onPress={() => router.push('/sign-in')} />
      </View>
      <Sheet
        visible={reading !== null}
        title={reading === 'privacy' ? t('signUp.privacyTitle') : t('signUp.termsTitle')}
        onClose={() => setReading(null)}
        width={tokens.width.reading}
        testID="reading-sheet"
      >
        <Text>{t('signUp.legalPending')}</Text>
      </Sheet>
    </AuthFrame>
  );
}
