import { View } from 'react-native';
import { Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t, type TextKey } from '@/i18n';
import { checkPassword } from './password';

const LEVELS = { weak: 1, okay: 2, strong: 3 } as const;

export function PasswordStrength({ password }: { password: string }) {
  const theme = useTheme();
  const { rules, strength } = checkPassword(password);
  const label = t(`signUp.strength.${strength}` as TextKey);
  const filled = password ? LEVELS[strength] : 0;
  const ruleRows: [boolean, TextKey][] = [
    [rules.length, 'signUp.rule.length'],
    [rules.mixed, 'signUp.rule.mixed'],
    [rules.common, 'signUp.rule.common'],
  ];
  return (
    <View style={{ gap: tokens.spacing['spacing-xs'] }} testID="password-strength">
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('signUp.strengthLabel', { level: label })}
        accessibilityValue={{ min: 0, max: 3, now: filled }}
        style={{ flexDirection: 'row', gap: tokens.spacing['spacing-xs'] }}
      >
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: tokens.radius['rounded-xs'],
              backgroundColor: i <= filled ? (strength === 'weak' ? theme.error : theme.primaryFill) : theme.border,
            }}
          />
        ))}
      </View>
      {password ? (
        <Text variant="caption" tone="textSecondary">
          {t('signUp.strengthLabel', { level: label })}
        </Text>
      ) : null}
      {ruleRows.map(([met, key]) => (
        <View key={key} style={{ flexDirection: 'row', gap: tokens.spacing['spacing-sm'], alignItems: 'center' }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: met ? theme.primaryFill : theme.inputBorder,
              backgroundColor: met ? theme.primaryFill : 'transparent',
            }}
          />
          <Text variant="caption" tone={met ? 'text' : 'textHelper'}>
            {t(key)}
          </Text>
        </View>
      ))}
    </View>
  );
}
