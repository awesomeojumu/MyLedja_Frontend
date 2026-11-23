import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, Fingerprint, Globe } from 'lucide-react-native';
import { useTheme, TextInput, Button } from '../../design';
import { useAuth } from './AuthProvider';
import { authApi } from '../../api/auth';
import { securityApi, isTwoFactorRequired } from '../../api/security';
import { ApiError, NetworkError } from '../../api/client';
import { t } from '../../i18n';
import { TwoFactorChallengeSheet } from './TwoFactorChallengeSheet';
import { PasskeyPromptSheet } from './PasskeyPromptSheet';

export function SignInScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { client, signedIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sheets
  const [twoFactorVisible, setTwoFactorVisible] = useState(false);
  const [passkeyVisible, setPasskeyVisible] = useState(false);

  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const errorText = (err: unknown) => {
    if (err instanceof NetworkError) return t('errors.network');
    if (err instanceof ApiError) {
      if (err.body.code === 'credentials_wrong') return t('signIn.wrong');
      if (err.body.code === 'too_many_attempts') return t('signIn.wait');
      if (err.body.code === 'email_not_verified') return t('signIn.emailNotVerified');
      return err.body.message || t('errors.generic');
    }
    return t('errors.generic');
  };

  const finish = (setupComplete: boolean) => router.replace((setupComplete ? '/' : '/welcome') as never);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError(t('signIn.wrong'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi(client).signIn({ email: email.trim(), password, staySignedIn });
      if (isTwoFactorRequired(res)) {
        setChallengeToken(res.challengeToken);
        setTwoFactorVisible(true);
        return;
      }
      await signedIn(res, staySignedIn);
      finish(res.user.setupComplete);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactor = async (code: string) => {
    if (!challengeToken) return;
    try {
      const res = await securityApi(client).twoFactorSignIn({
        challengeToken,
        code: code.length === 6 ? code : undefined,
        backupCode: code.length === 6 ? undefined : code,
        trustDevice: false,
        staySignedIn,
      });
      setTwoFactorVisible(false);
      await signedIn(res, staySignedIn);
      finish(res.user.setupComplete);
    } catch (err) {
      setTwoFactorVisible(false);
      setError(errorText(err));
    }
  };

  // Google needs the platform sign-in SDK, which isn't in this build yet.
  const handleSocialGoogle = () => setError(t('signIn.googleUnavailable'));

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
        {/* Brand Heading */}
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
            {t('ui.signInScreen.myledja')}
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
            {t('ui.signInScreen.signInToAccessYour')}
          </Text>
        </View>

        {/* Error message */}
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

        {/* Email Input */}
        <TextInput
          label={t('ui.signInScreen.emailAddress')}
          placeholder={t('ui.signInScreen.youDomainCom')}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (error) setError('');
          }}
          leftElement={<Mail size={18} color={colors.textTertiary} />}
        />

        {/* Password Input */}
        <View style={{ marginTop: spacing.md }}>
          <TextInput
            label={t('ui.signInScreen.password')}
            placeholder="••••••••••••"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError('');
            }}
            leftElement={<Lock size={18} color={colors.textTertiary} />}
            rightElement={
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                {showPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            }
          />
        </View>

        {/* Stay Signed in & Forgot Password */}
        <View style={[styles.optionsRow, { marginVertical: spacing.md }]}>
          <TouchableOpacity
            onPress={() => setStaySignedIn((prev) => !prev)}
            style={styles.checkboxRow}
          >
            <View
              style={[
                styles.checkboxBox,
                {
                  borderColor: staySignedIn ? colors.primary : colors.border,
                  backgroundColor: staySignedIn ? colors.primary : colors.surfaceSubtle,
                  borderRadius: radii.xs,
                },
              ]}
            >
              {staySignedIn && <Text style={{ color: '#FFFFFF', fontSize: 10 }}>✓</Text>}
            </View>
            <Text
              style={[
                styles.checkboxLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              {t('ui.signInScreen.staySignedIn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/recover' as any)}>
            <Text
              style={[
                styles.forgotLink,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                },
              ]}
            >
              {t('ui.signInScreen.forgotPassword')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary CTA */}
        <Button
          label={t('ui.signInScreen.signIn')}
          onPress={handleSignIn}
          variant="primary"
          size="lg"
          loading={loading}
        />

        {/* Divider */}
        <View style={[styles.dividerRow, { marginVertical: spacing.lg }]}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text
            style={[
              styles.dividerText,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                marginHorizontal: spacing.sm,
              },
            ]}
          >
            {t('ui.signInScreen.or')}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Secondary Auth Options */}
        <View style={{ gap: 8 }}>
          <Button
            label={t('ui.signInScreen.signInWithPasskeyBiometrics')}
            onPress={() => setPasskeyVisible(true)}
            variant="secondary"
            icon={<Fingerprint size={18} color={colors.primary} />}
          />

          <Button
            label={t('ui.signInScreen.continueWithGoogle')}
            onPress={handleSocialGoogle}
            variant="secondary"
            icon={<Globe size={18} color={colors.textSecondary} />}
          />
        </View>

        {/* Footer Link to Sign Up */}
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
            {t('signIn.newPrompt')}{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/sign-up' as any)}>
            <Text
              style={[
                styles.signUpLink,
                {
                  color: colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.sm,
                },
              ]}
            >
              {t('ui.signInScreen.signUp')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sheets */}
      <TwoFactorChallengeSheet
        visible={twoFactorVisible}
        onClose={() => setTwoFactorVisible(false)}
        onVerify={(code) => void handleTwoFactor(code)}
      />

      <PasskeyPromptSheet
        visible={passkeyVisible}
        onClose={() => setPasskeyVisible(false)}
        onAuthenticate={async () => {
          await handleSignIn();
        }}
      />
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
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {},
  forgotLink: {},
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {},
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {},
  signUpLink: {},
});
