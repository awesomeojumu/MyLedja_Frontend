import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { Banner, Button, CodeInput, InlineError, Text, TextInput } from '@/design/components';
import { isRedesignEnabled } from '@/design/redesign';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { AuthFrame } from './AuthFrame';
import { AuthStepPanel } from './AuthStepPanel';
import { useAuth } from './AuthProvider';
import { checkPassword, EMAIL_PATTERN } from './password';
import { PasswordStrength } from './PasswordStrength';
import { RedesignRecoverScreen } from './RedesignRecoverScreen';

export function RecoverScreen({ now = () => Date.now() }: { now?: () => number }) {
  if (isRedesignEnabled()) return <RedesignRecoverScreen now={now} />;
  return <LegacyRecoverScreen now={now} />;
}

function LegacyRecoverScreen({ now = () => Date.now() }: { now?: () => number }) {
  const router = useRouter();
  const { api } = useAuth();
  const online = useOnline();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'email' | 'code' | 'password' | 'confirm' | 'form', string>>>({});
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const secondsLeft = waitUntil ? Math.max(0, Math.ceil((waitUntil - now()) / 1000)) : 0;
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
      await api.recover({ email: email.trim() });
      setStep('reset');
    } catch (e) {
      if (!applyRateLimit(e)) setErrors({ form: t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy || secondsLeft > 0) return;
    const next: typeof errors = {};
    if (code.length !== 6) next.code = t('errors.codeIncomplete');
    if (!checkPassword(password).ok) next.password = t('errors.passwordWeak');
    if (confirm !== password) next.confirm = t('errors.passwordsDiffer');
    setErrors(next);
    if (Object.keys(next).length || !online) return;
    setBusy(true);
    try {
      await api.newPassword({ email: email.trim(), code, newPassword: password });
      setStep('done');
    } catch (e) {
      if (applyRateLimit(e)) {
        /* wait copy set */
      } else if (e instanceof ApiError && e.status === 400) {
        setErrors({ code: t('errors.codeInvalid') });
      } else {
        setErrors({ form: t('errors.network') });
      }
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || !online || secondsLeft > 0;

  return (
    <AuthFrame>
      <AuthStepPanel step={step}>
        {step === 'done' ? (
          <>
            <Text variant="display-md" accessibilityRole="header" testID="recover-done">
              {t('recover.doneTitle')}
            </Text>
            <Button kind="gradient" label={t('recover.toSignIn')} fullWidth onPress={() => router.replace('/sign-in')} />
          </>
        ) : (
          <>
            <Text variant="display-md" accessibilityRole="header">
              {t('recover.title')}
            </Text>
            {step === 'email' ? (
              <>
                <TextInput
                  testID="email"
                  label={t('auth.email')}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  error={errors.email}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={() => void send()}
                />
                {errors.form ? <InlineError testID="recover-error" message={errors.form} /> : null}
                {secondsLeft > 0 ? (
                  <Text variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
                    {t('signIn.waitCountdown', { seconds: secondsLeft })}
                  </Text>
                ) : null}
                <Button testID="send-code" kind="gradient" label={t('recover.submit')} onPress={send} disabled={disabled} fullWidth />
              </>
            ) : (
              <>
                <Banner testID="recover-sent" message={t('recover.sent')} />
                <CodeInput value={code} onChange={setCode} error={errors.code} />
                <TextInput
                  testID="new-password"
                  label={t('recover.newPassword')}
                  value={password}
                  onChangeText={setPassword}
                  secure
                  autoComplete="new-password"
                  textContentType="newPassword"
                  error={errors.password}
                  returnKeyType="next"
                />
                <PasswordStrength password={password} />
                <TextInput
                  testID="confirm-password"
                  label={t('recover.confirmPassword')}
                  value={confirm}
                  onChangeText={setConfirm}
                  secure
                  autoComplete="new-password"
                  error={errors.confirm}
                  returnKeyType="go"
                  onSubmitEditing={() => void save()}
                />
                {errors.form ? <InlineError testID="recover-error" message={errors.form} /> : null}
                {secondsLeft > 0 ? (
                  <Text variant="caption" tone="textSecondary" accessibilityLiveRegion="polite">
                    {t('signIn.waitCountdown', { seconds: secondsLeft })}
                  </Text>
                ) : null}
                <Button testID="save-password" kind="gradient" label={t('recover.save')} onPress={save} disabled={disabled} fullWidth />
              </>
            )}
            <Button kind="link" label={t('recover.backToSignIn')} onPress={() => router.replace('/sign-in')} />
          </>
        )}
      </AuthStepPanel>
    </AuthFrame>
  );
}
