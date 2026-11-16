import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../src/design';

export default function SignUpRoute() {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.lg }]}>
      <Text
        style={[
          styles.heading,
          {
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.xxl,
          },
        ]}
      >
        Sign Up
      </Text>
      <Text
        style={[
          styles.description,
          {
            color: colors.textSecondary,
            fontFamily: typography.fonts.regular,
            fontSize: typography.sizes.body,
            marginTop: spacing.xs,
          },
        ]}
      >
        Create an account with 6-digit OTP verification.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {},
  description: {},
});
