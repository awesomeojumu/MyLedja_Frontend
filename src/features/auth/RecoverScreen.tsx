import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthProvider';
import { authApi } from '../../api/auth';
import { ApiError, NetworkError } from '../../api/client';
import { t } from '../../i18n';
import { Mail, Lock, KeyRound } from 'lucide-react-native';
import { useTheme, TextInput, Button } from '../../design';

export function RecoverScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { client } = useAuth();

  const errorText = (err: unknown) => {
    if (err instanceof NetworkError) return t('errors.network');
    if (err instanceof ApiError) return err.body.code === 'code_invalid' ? t('errors.codeInvalid') : err.body.message || t('errors.generic');
    return t('errors.generic');
  };

  const handleRequestCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError(t('errors.emailInvalid'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi(client).recover({ email: email.trim() });
      setStep('reset');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (code.length !== 6) {
      setError(t('errors.codeIncomplete'));
      return;
    }
    // Same minimum as the server (PASSWORD_MIN_LENGTH).
    if (newPassword.length < 10) {
      setError(t('signUp.rule.length'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi(client).newPassword({ email: email.trim(), code, newPassword });
      setSuccess(t('recover.doneTitle'));
      setTimeout(() => router.replace('/sign-in' as never), 1500);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.root,
        { backgroundColor: colors.background, padding: spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.xl,
          },
        ]}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.full,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <KeyRound size={28} color={colors.primary} />
          </View>
          <Text
            style={[
              styles.brandTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.xl,
              },
            ]}
          >
            {t('ui.recoverScreen.recoverAccount')}
          </Text>
          <Text
            style={[
              styles.tagline,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
                marginTop: 4,
                textAlign: 'center',
              },
            ]}
          >
            {step === 'request'
              ? "Enter your registered email and we'll send a 6-digit recovery code"
              : `Enter the 6-digit code sent to ${email} and choose a new password`}
          </Text>
        </View>

        {error ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: colors.statusDangerLight,
                borderColor: colors.statusDanger,
                borderRadius: radii.md,
                padding: spacing.sm,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text style={{ color: colors.statusDanger, fontSize: typography.sizes.xs, textAlign: 'center' }}>
              {error}
            </Text>
          </View>
        ) : null}

        {success ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: colors.statusSuccessLight,
                borderColor: colors.statusSuccess,
                borderRadius: radii.md,
                padding: spacing.sm,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text style={{ color: colors.statusSuccess, fontSize: typography.sizes.xs, textAlign: 'center' }}>
              {success}
            </Text>
          </View>
        ) : null}

        {step === 'request' ? (
          <>
            <TextInput
              label={t('ui.recoverScreen.emailAddress')}
              placeholder={t('ui.recoverScreen.youDomainCom')}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError('');
              }}
              leftElement={<Mail size={18} color={colors.textTertiary} />}
            />

            <View style={{ marginTop: spacing.xl }}>
              <Button
                label={t('ui.recoverScreen.sendRecoveryCode')}
                onPress={handleRequestCode}
                variant="primary"
                size="lg"
              />
            </View>
          </>
        ) : (
          <>
            <TextInput
              label={t('ui.recoverScreen.6DigitCode')}
              placeholder="123456"
              maxLength={6}
              keyboardType="numeric"
              value={code}
              onChangeText={(v) => {
                setCode(v);
                if (error) setError('');
              }}
              style={{ letterSpacing: 6, textAlign: 'center', fontSize: typography.sizes.lg }}
            />

            <View style={{ marginTop: spacing.md }}>
              <TextInput
                label={t('ui.recoverScreen.newPassword')}
                placeholder={t('ui.recoverScreen.atLeast8Characters')}
                secureTextEntry
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  if (error) setError('');
                }}
                leftElement={<Lock size={18} color={colors.textTertiary} />}
              />
            </View>

            <View style={{ marginTop: spacing.xl, gap: 8 }}>
              <Button
                label={t('ui.recoverScreen.resetPassword')}
                onPress={handleResetPassword}
                variant="primary"
                size="lg"
                loading={loading}
              />
              <Button
                label={t('ui.recoverScreen.backToEmail')}
                onPress={() => setStep('request')}
                variant="ghost"
              />
            </View>
          </>
        )}

        <View style={[styles.footerRow, { marginTop: spacing.xl }]}>
          <TouchableOpacity onPress={() => router.push('/sign-in' as any)}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.sm,
              }}
            >
              {t('ui.recoverScreen.rememberPasswordSignIn')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
  },
  iconWrap: {},
  brandTitle: {},
  tagline: {},
  banner: {
    borderWidth: 1,
  },
  footerRow: {
    alignItems: 'center',
  },
});
