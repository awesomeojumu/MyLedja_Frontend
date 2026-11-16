import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, User, Globe, Check } from 'lucide-react-native';
import { useTheme, TextInput, Button } from '../../design';
import { useAuth } from './AuthProvider';
import { TermsPrivacySheet } from './TermsPrivacySheet';

export function SignUpScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { setSession } = useAuth();

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
  const hasMinLength = password.length >= 8;
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
    // Advance to OTP step
    setStep('otp');
  };

  const handleVerifyOtp = async (code: string) => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await setSession({
        id: `usr-${Date.now()}`,
        email: email.trim(),
        name: name.trim(),
        setupComplete: false,
        workspaceId: 'default',
        workspaceName: 'Personal',
      });
      // New users land on Welcome setup wizard
      router.replace('/welcome' as any);
    } catch {
      setError('Verification code is invalid or has expired');
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
              label="Full Name"
              placeholder="e.g. Tunde Adebayo"
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (error) setError('');
              }}
              leftElement={<User size={18} color={colors.textTertiary} />}
            />

            <View style={{ marginTop: spacing.md }}>
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
            </View>

            <View style={{ marginTop: spacing.md }}>
              <TextInput
                label="Create Password"
                placeholder="At least 8 characters"
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
                  8+ characters
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: hasNumber ? colors.statusSuccess : colors.border }]} />
                <Text style={[styles.ruleText, { color: hasNumber ? colors.statusSuccess : colors.textTertiary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
                  1+ number
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: hasSymbol ? colors.statusSuccess : colors.border }]} />
                <Text style={[styles.ruleText, { color: hasSymbol ? colors.statusSuccess : colors.textTertiary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
                  1+ symbol
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
                I agree to the{' '}
                <Text
                  onPress={() => setTermsVisible(true)}
                  style={{ color: colors.primary, fontFamily: typography.fonts.medium }}
                >
                  Terms of Service & Privacy Policy
                </Text>
              </Text>
            </View>

            <Button
              label="Create Account"
              onPress={handleCreateAccount}
              variant="primary"
              size="lg"
            />

            {/* Google Signup bypass */}
            <View style={{ marginTop: spacing.md }}>
              <Button
                label="Sign up with Google"
                onPress={async () => {
                  await setSession({
                    id: 'usr-google',
                    email: 'user@gmail.com',
                    name: 'Google User',
                    setupComplete: false,
                    workspaceId: 'default',
                    workspaceName: 'Personal',
                  });
                  router.replace('/welcome' as any);
                }}
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
              We sent a 6-digit confirmation code to{' '}
              <Text style={{ fontFamily: typography.fonts.medium, color: colors.textPrimary }}>
                {email}
              </Text>
            </Text>

            <TextInput
              label="6-Digit Verification Code"
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
                label="Verify Code"
                onPress={() => handleVerifyOtp(otp)}
                variant="primary"
                size="lg"
                loading={loading}
              />
              <Button
                label="Wrong email? Change it"
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
            Already have an account?{' '}
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
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TermsPrivacySheet visible={termsVisible} onClose={() => setTermsVisible(false)} />
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
