import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, Fingerprint, Globe } from 'lucide-react-native';
import { useTheme, TextInput, Button } from '../../design';
import { useAuth } from './AuthProvider';
import { TwoFactorChallengeSheet } from './TwoFactorChallengeSheet';
import { PasskeyPromptSheet } from './PasskeyPromptSheet';

export function SignInScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { setSession } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sheets
  const [twoFactorVisible, setTwoFactorVisible] = useState(false);
  const [passkeyVisible, setPasskeyVisible] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Simulate/Trigger sign-in
      await setSession({
        id: 'usr-1',
        email: email.trim(),
        name: 'MyLedja User',
        setupComplete: true,
        workspaceId: 'default',
        workspaceName: 'Personal',
      });
      router.replace('/' as any);
    } catch {
      setError('Email or password is wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialGoogle = async () => {
    setLoading(true);
    try {
      await setSession({
        id: 'usr-google',
        email: 'user@gmail.com',
        name: 'Google User',
        setupComplete: true,
        workspaceId: 'default',
        workspaceName: 'Personal',
      });
      router.replace('/' as any);
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
            MyLedja
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
            Sign in to access your financial ledger
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
          label="Email Address"
          placeholder="you@domain.com"
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
            label="Password"
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
              Stay signed in
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
              Forgot password?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary CTA */}
        <Button
          label="Sign In"
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
                color: colors.textTertiary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                marginHorizontal: spacing.sm,
              },
            ]}
          >
            OR
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Secondary Auth Options */}
        <View style={{ gap: 8 }}>
          <Button
            label="Sign in with Passkey / Biometrics"
            onPress={() => setPasskeyVisible(true)}
            variant="secondary"
            icon={<Fingerprint size={18} color={colors.primary} />}
          />

          <Button
            label="Continue with Google"
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
            Don't have an account?{' '}
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
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sheets */}
      <TwoFactorChallengeSheet
        visible={twoFactorVisible}
        onClose={() => setTwoFactorVisible(false)}
        onVerify={() => router.replace('/' as any)}
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
