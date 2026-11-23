import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, User, Globe, Check } from 'lucide-react-native';
import { useTheme, TextInput, Button } from '../../design';
import { useAuth } from './AuthProvider';
import { authApi } from '../../api/auth';
import { ApiError, NetworkError } from '../../api/client';
import { t } from '../../i18n';
import { TermsPrivacySheet } from './TermsPrivacySheet';

export function SignUpScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { client, signedIn } = useAuth();

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Terms sheet
  const [termsVisible, setTermsVisible] = useState(false);

  // Password rules validation
  // Same minimum as the server (PASSWORD_MIN_LENGTH).
  const hasMinLength = password.length >= 10;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasSymbol;

  const handleCreateAccount = () => {
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!isPasswordValid) {
      setError('Password must meet security requirements');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the terms & privacy policy to continue');
      return;
    }
    setError('');
    setLoading(true);
    authApi(client)
      .signUp({ name: name.trim(), email: email.trim(), password, termsAccepted: true })
      .then(() => setStep('otp'))
      .catch((err: unknown) => setError(errorText(err)))
      .finally(() => setLoading(false));
  };

  const errorText = (err: unknown) => {
    if (err instanceof NetworkError) return t('errors.network');
    if (err instanceof ApiError) return err.body.code === 'code_invalid' ? t('errors.codeInvalid') : err.body.message || t('errors.generic');
    return t('errors.generic');
  };

  const handleVerifyOtp = async (code: string) => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await authApi(client).verifyEmail({ email: email.trim(), code, staySignedIn: true });
      await signedIn(res, true);
      // New people land on Welcome.
      router.replace((res.user.setupComplete ? '/' : '/welcome') as never);
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
          <Text
            style={[
              styles.brandTitle,
              {
                color: colors.primary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.heroSm,
              },
            ]}
          >
            {t('ui.signUpScreen.myledja')}
          </Text>
          <Text
            style={[
              styles.tagline,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
                marginTop: 4,
              },
            ]}
          >
            {step === 'form' ? 'Create your private financial ledger' : 'Verify your email address'}
          </Text>
        </View>

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.statusDangerLight,
                borderColor: colors.statusDanger,
                borderRadius: radii.md,
                padding: spacing.sm,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: colors.statusDanger,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                textAlign: 'center',
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {step === 'form' ? (
          <>
            {/* Step 1: Registration Form */}
            <TextInput
              label={t('ui.signUpScreen.fullName')}
              placeholder={t('ui.signUpScreen.eGTundeAdebayo')}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (error) setError('');
              }}
              leftElement={<User size={18} color={colors.textTertiary} />}
            />

            <View style={{ marginTop: spacing.md }}>
              <TextInput
                label={t('ui.signUpScreen.emailAddress')}
                placeholder={t('ui.signUpScreen.youDomainCom')}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (error) setError('');
                }}
                leftElement={<Mail size={18} color={colors.textTertiary} />}
              />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <TextInput
                label={t('ui.signUpScreen.createPassword')}
                placeholder={t('signUp.rule.length')}
                secureTextEntry
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError('');
                }}
                leftElement={<Lock size={18} color={colors.textTertiary} />}
              />
            </View>

            {/* Password Requirements Checklist */}
            <View style={[styles.rulesList, { marginTop: spacing.sm }]}>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: hasMinLength ? colors.statusSuccess : colors.border }]} />
                <Text style={[styles.ruleText, { color: hasMinLength ? colors.statusSuccess : colors.textTertiary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
                  {t('signUp.rule.length')}
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: hasNumber ? colors.statusSuccess : colors.border }]} />
                <Text style={[styles.ruleText, { color: hasNumber ? colors.statusSuccess : colors.textTertiary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
                  {t('ui.signUpScreen.1Number')}
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: hasSymbol ? colors.statusSuccess : colors.border }]} />
                <Text style={[styles.ruleText, { color: hasSymbol ? colors.statusSuccess : colors.textTertiary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
                  {t('ui.signUpScreen.1Symbol')}
                </Text>
              </View>
            </View>

            {/* Terms Checkbox */}
            <View style={[styles.termsRow, { marginVertical: spacing.md }]}>
              <TouchableOpacity
                onPress={() => setTermsAccepted((prev) => !prev)}
                style={[
                  styles.checkboxBox,
                  {
                    borderColor: termsAccepted ? colors.primary : colors.border,
                    backgroundColor: termsAccepted ? colors.primary : colors.surfaceSubtle,
                    borderRadius: radii.xs,
                  },
                ]}
              >
                {termsAccepted && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </TouchableOpacity>
              <Text
                style={[
                  styles.termsText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    fontSize: typography.sizes.xs,
                    marginLeft: spacing.xs,
                    flex: 1,
                  },
                ]}
              >
                {t('ui.signUpScreen.iAgreeToThe')}{' '}
                <Text
                  onPress={() => setTermsVisible(true)}
                  style={{ color: colors.primary, fontFamily: typography.fonts.medium }}
                >
                  {t('ui.signUpScreen.termsOfServiceAndPrivacy')}
                </Text>
              </Text>
            </View>

            <Button
              label={t('ui.signUpScreen.createAccount')}
              onPress={handleCreateAccount}
              variant="primary"
              size="lg"
            />

            {/* Google needs the platform sign-in SDK, which isn't in this build yet. */}
            <View style={{ marginTop: spacing.md }}>
              <Button
                label={t('ui.signUpScreen.signUpWithGoogle')}
                onPress={() => setError(t('signIn.googleUnavailable'))}
                variant="secondary"
                icon={<Globe size={18} color={colors.textSecondary} />}
              />
            </View>
          </>
        ) : (
          <>
            {/* Step 2: 6-Digit Email OTP Verification */}
            <Text
              style={[
                styles.otpInstructions,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.sm,
                  textAlign: 'center',
                  marginBottom: spacing.lg,
                },
              ]}
            >
              {t('ui.signUpScreen.weSentA6Digit')}{' '}
              <Text style={{ fontFamily: typography.fonts.medium, color: colors.textPrimary }}>
                {email}
              </Text>
            </Text>

            <TextInput
              label={t('ui.signUpScreen.6DigitVerificationCode')}
              placeholder="123456"
              maxLength={6}
              keyboardType="numeric"
              value={otp}
              onChangeText={(v) => {
                setOtp(v);
                if (error) setError('');
                if (v.length === 6) {
                  void handleVerifyOtp(v);
                }
              }}
              style={{ letterSpacing: 6, textAlign: 'center', fontSize: typography.sizes.xl }}
            />

            <View style={{ marginTop: spacing.xl, gap: 8 }}>
              <Button
                label={t('ui.signUpScreen.verifyCode')}
                onPress={() => handleVerifyOtp(otp)}
                variant="primary"
                size="lg"
                loading={loading}
              />
              <Button
                label={t('ui.signUpScreen.wrongEmailChangeIt')}
                onPress={() => {
                  setStep('form');
                  setOtp('');
                }}
                variant="ghost"
              />
            </View>
          </>
        )}

        {/* Footer Link to Sign In */}
        <View style={[styles.footerRow, { marginTop: spacing.xl }]}>
          <Text
            style={[
              styles.footerText,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.sm,
              },
            ]}
          >
            {t('ui.signUpScreen.alreadyHaveAnAccount')}{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/sign-in' as any)}>
            <Text
              style={[
                styles.signInLink,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                },
              ]}
            >
              {t('ui.signUpScreen.signIn')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TermsPrivacySheet visible={termsVisible} onClose={() => setTermsVisible(false)} onAgree={() => setTermsAccepted(true)} />
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
  brandTitle: {
    letterSpacing: -0.5,
  },
  tagline: {},
  errorBanner: {
    borderWidth: 1,
  },
  rulesList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  ruleText: {},
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {},
  otpInstructions: {},
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {},
  signInLink: {},
});
