import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
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

  const handleRequestCode = () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setStep('reset');
  };

  const handleResetPassword = () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit recovery code');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }
    setError('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSuccess('Password changed successfully. All other devices have been signed out.');
      setTimeout(() => {
        router.replace('/sign-in' as any);
      }, 1500);
    }, 600);
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
            Recover Account
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

            <View style={{ marginTop: spacing.xl }}>
              <Button
                label="Send Recovery Code"
                onPress={handleRequestCode}
                variant="primary"
                size="lg"
              />
            </View>
          </>
        ) : (
          <>
            <TextInput
              label="6-Digit Code"
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
                label="New Password"
                placeholder="At least 8 characters"
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
                label="Reset Password"
                onPress={handleResetPassword}
                variant="primary"
                size="lg"
                loading={loading}
              />
              <Button
                label="Back to Email"
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
              Remember password? Sign In
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
