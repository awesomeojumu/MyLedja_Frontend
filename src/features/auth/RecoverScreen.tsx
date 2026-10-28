import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ApiError } from '@/api/client';
import { Banner, Button, CodeInput, InlineError, Text, TextInput } from '@/design/components';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { AuthFrame } from './AuthFrame';
import { AuthStepPanel } from './AuthStepPanel';
import { useAuth } from './AuthProvider';
import { checkPassword, EMAIL_PATTERN } from './password';
import { PasswordStrength } from './PasswordStrength';

export function RecoverScreen() {
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

  const send = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setErrors({ email: t('errors.emailInvalid') });
      return;
    }
    if (!online) return;
    setBusy(true);
    setErrors({});
    try {
      await api.recover({ email: email.trim() });
      setStep('reset');
    } catch {
      setErrors({ form: t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
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
      setErrors(e instanceof ApiError && e.status === 400 ? { code: t('errors.codeInvalid') } : { form: t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

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
                />
                {errors.form ? <InlineError message={errors.form} /> : null}
                <Button testID="send-code" kind="gradient" label={t('recover.submit')} onPress={send} disabled={busy || !online} fullWidth />
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
                />
                {errors.form ? <InlineError message={errors.form} /> : null}
                <Button testID="save-password" kind="gradient" label={t('recover.save')} onPress={save} disabled={busy || !online} fullWidth />
              </>
            )}
            {step !== 'done' ? (
              <Button kind="link" label={t('recover.backToSignIn')} onPress={() => router.replace('/sign-in')} />
            ) : null}
          </>
        )}
      </AuthStepPanel>
    </AuthFrame>
  );
}
