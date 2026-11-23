import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { useTheme, BottomSheet, TextInput, Button } from '../../design';
import { useAuth } from '../auth/AuthProvider';
import { securityApi } from '../../api/security';

import { t as i18nT } from '../../i18n';
interface ChangePasswordSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ChangePasswordSheet({ visible, onClose, onSuccess }: ChangePasswordSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { client } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signOutOtherDevices, setSignOutOtherDevices] = useState(true);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password');
      return;
    }
    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password');
      return;
    }

    setLoading(true);

    try {
      if (client) {
        await securityApi(client).changePassword({
          currentPassword,
          newPassword,
          signOutOtherDevices,
        });
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Failed to update password. Please verify your current password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess(false);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} title={i18nT('ui.changePasswordSheet.changePassword')}>
      <View style={styles.container}>
        {success ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <View
              style={[
                styles.successCircle,
                {
                  backgroundColor: colors.statusSuccessLight,
                  borderRadius: radii.full,
                  width: 54,
                  height: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.md,
                },
              ]}
            >
              <CheckCircle2 size={32} color={colors.statusSuccess} />
            </View>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: 4,
              }}
            >
              {i18nT('ui.changePasswordSheet.passwordChangedSuccessfully')}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                textAlign: 'center',
              }}
            >
              {signOutOtherDevices
                ? 'Your new password is now active and other active sessions have been securely terminated.'
                : 'Your new password is now active.'}
            </Text>
          </View>
        ) : (
          <View>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                marginBottom: spacing.md,
                lineHeight: 18,
              }}
            >
              {i18nT('ui.changePasswordSheet.createAStrongPasswordWith')}
            </Text>

            {error && (
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
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {error}
                </Text>
              </View>
            )}

            <View style={{ gap: 14, marginBottom: spacing.md }}>
              {/* Current Password */}
              <View>
                <TextInput
                  label={i18nT('ui.changePasswordSheet.currentPassword')}
                  value={currentPassword}
                  onChangeText={(t) => {
                    setCurrentPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showCurrent}
                  leftElement={<Lock size={16} color={colors.textTertiary} />}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={{ padding: 4 }}>
                      {showCurrent ? (
                        <EyeOff size={16} color={colors.textSecondary} />
                      ) : (
                        <Eye size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  }
                  placeholder={i18nT('ui.changePasswordSheet.enterCurrentPassword')}
                />
              </View>

              {/* New Password */}
              <View>
                <TextInput
                  label={i18nT('ui.changePasswordSheet.newPassword')}
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showNew}
                  leftElement={<Lock size={16} color={colors.textTertiary} />}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowNew(!showNew)} style={{ padding: 4 }}>
                      {showNew ? (
                        <EyeOff size={16} color={colors.textSecondary} />
                      ) : (
                        <Eye size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  }
                  placeholder={i18nT('ui.changePasswordSheet.atLeast10Characters')}
                />
                <Text
                  style={{
                    color: newPassword.length >= 10 ? colors.statusSuccess : colors.textTertiary,
                    fontSize: 10,
                    marginTop: 4,
                    fontFamily: typography.fonts.regular,
                  }}
                >
                  {newPassword.length >= 10 ? '✓ Meets minimum length' : `${newPassword.length}/10 characters`}
                </Text>
              </View>

              {/* Confirm Password */}
              <View>
                <TextInput
                  label={i18nT('ui.changePasswordSheet.confirmNewPassword')}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showConfirm}
                  leftElement={<Lock size={16} color={colors.textTertiary} />}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
                      {showConfirm ? (
                        <EyeOff size={16} color={colors.textSecondary} />
                      ) : (
                        <Eye size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  }
                  placeholder={i18nT('ui.changePasswordSheet.reTypeNewPassword')}
                />
              </View>
            </View>

            {/* Sign Out Other Devices Toggle */}
            <View
              style={[
                styles.toggleRow,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                },
              ]}
            >
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {i18nT('ui.changePasswordSheet.signOutOtherDevices')}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    marginTop: 1,
                  }}
                >
                  {i18nT('ui.changePasswordSheet.revokeSessionsOnAllOther')}
                </Text>
              </View>
              <Switch
                value={signOutOtherDevices}
                onValueChange={setSignOutOtherDevices}
                trackColor={{ false: colors.borderSubtle, true: colors.primary }}
              />
            </View>

            <Button
              label={loading ? 'Updating Password...' : 'Save New Password'}
              onPress={handleSubmit}
              variant="primary"
              size="lg"
              disabled={loading}
              icon={<ShieldCheck size={16} color="#FFFFFF" />}
            />
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  successCircle: {},
  errorBanner: {
    borderWidth: 1,
  },
  toggleRow: {},
});
