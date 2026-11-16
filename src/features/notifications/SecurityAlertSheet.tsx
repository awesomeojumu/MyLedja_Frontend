import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert, Laptop } from 'lucide-react-native';
import { useTheme, BottomSheet, Button } from '../../design';

interface SecurityAlertSheetProps {
  visible: boolean;
  onClose: () => void;
  deviceInfo: string;
  location: string;
  timestamp: string;
  onSignOutOthers: () => void;
}

export function SecurityAlertSheet({
  visible,
  onClose,
  deviceInfo,
  location,
  timestamp,
  onSignOutOthers,
}: SecurityAlertSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Security Alert: New Sign-In">
      <View style={styles.container}>
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: colors.statusWarningLight,
              borderColor: colors.statusWarning,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldAlert size={18} color={colors.statusWarning} />
            <Text
              style={{
                color: colors.statusWarning,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.sm,
                marginLeft: spacing.xs,
              }}
            >
              Unrecognized Device Detected
            </Text>
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.bodySm,
              marginTop: spacing.xs,
            }}
          >
            A new session was initiated from {deviceInfo} in {location} at {timestamp}.
          </Text>
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <Button
            label="This Was Me (Dismiss)"
            onPress={onClose}
            variant="secondary"
            size="lg"
          />
        </View>

        <Button
          label="Sign Out All Other Devices"
          onPress={() => {
            onSignOutOthers();
            onClose();
          }}
          variant="danger"
          size="lg"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  alertBox: {
    borderWidth: 1,
  },
});
