import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../theme';
import { t } from '../../i18n';

interface ThemeToggleProps {
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ThemeToggle({ showLabel = false, size = 'md' }: ThemeToggleProps) {
  const { isDark, toggleTheme, colors, typography, spacing, radii } = useTheme();

  const iconSize = size === 'sm' ? 16 : 20;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={isDark ? t('theme.toLight') : t('theme.toDark')}
      onPress={toggleTheme}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: colors.surfaceSubtle,
          borderColor: colors.border,
          borderRadius: radii.full,
          paddingVertical: size === 'sm' ? spacing.xs : spacing.sm,
          paddingHorizontal: size === 'sm' ? spacing.sm : spacing.md,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        {isDark ? (
          <Sun size={iconSize} color={colors.primary} />
        ) : (
          <Moon size={iconSize} color={colors.textSecondary} />
        )}
      </View>
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: colors.textPrimary,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fonts.medium,
              marginLeft: spacing.sm,
            },
          ]}
        >
          {isDark ? t('theme.light') : t('theme.dark')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    userSelect: 'none',
  },
});
