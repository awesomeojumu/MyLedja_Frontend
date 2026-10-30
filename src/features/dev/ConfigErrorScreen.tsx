import { View } from 'react-native';
import { Text } from '@/design/components';
import { isRedesignEnabled } from '@/design/redesign';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { RedesignConfigErrorScreen } from './RedesignConfigErrorScreen';

/** Development only: names the missing variables, never their values. */
export function ConfigErrorScreen({ problems }: { problems: string[] }) {
  if (isRedesignEnabled()) return <RedesignConfigErrorScreen problems={problems} />;
  return <LegacyConfigErrorScreen problems={problems} />;
}

function LegacyConfigErrorScreen({ problems }: { problems: string[] }) {
  const theme = useTheme();
  return (
    <View
      testID="config-error"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.page,
        padding: tokens.spacing['spacing-xl'],
        gap: tokens.spacing['spacing-md'],
      }}
    >
      <Text variant="heading-md" accessibilityRole="header">
        {t('dev.configTitle')}
      </Text>
      <Text tone="textSecondary">{t('dev.configBody', { names: problems.join(', ') })}</Text>
    </View>
  );
}
