import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { colors, typography, spacing, radii } = useTheme();

  // Size specifications
  const sizeStyles = {
    sm: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, fontSize: typography.sizes.sm },
    md: { paddingVertical: spacing.sm + 4, paddingHorizontal: spacing.lg, fontSize: typography.sizes.bodySm },
    lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, fontSize: typography.sizes.md },
  }[size];

  // Variant specifications
  let bg = colors.primary;
  let textCol = colors.textInverse;
  let borderCol = 'transparent';

  if (variant === 'secondary') {
    bg = colors.surfaceSubtle;
    textCol = colors.textPrimary;
    borderCol = colors.border;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    textCol = colors.primary;
    borderCol = 'transparent';
  } else if (variant === 'danger') {
    bg = colors.statusDanger;
    textCol = '#FFFFFF';
    borderCol = 'transparent';
  }

  if (disabled) {
    bg = colors.surfaceSubtle;
    textCol = colors.textTertiary;
    borderCol = colors.borderSubtle;
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.baseButton,
        {
          backgroundColor: bg,
          borderColor: borderCol,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderRadius: radii.full,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textCol} />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            style={[
              styles.baseText,
              {
                color: textCol,
                fontSize: sizeStyles.fontSize,
                fontFamily: typography.fonts.medium,
                marginLeft: icon ? spacing.xs : 0,
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    textAlign: 'center',
    userSelect: 'none',
  },
});
