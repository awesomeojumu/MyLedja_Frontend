import { View } from 'react-native';
import { PillTag, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t, type TextKey } from '@/i18n';
import { useAuth, type ApiSource } from '@/features/auth/AuthProvider';

const SOURCES: { source: ApiSource; label: TextKey }[] = [
  { source: 'mock', label: 'dev.apiMock' },
  { source: 'local', label: 'dev.apiLocal' },
  { source: 'staging', label: 'dev.apiStaging' },
];

/** Development builds only: switch the API between the mock adapter, a local backend and staging. */
export function DevMenu() {
  const theme = useTheme();
  const { source, setSource } = useAuth();
  return (
    <View
      testID="dev-menu"
      accessibilityLabel={t('dev.menuTitle')}
      style={{
        position: 'absolute',
        right: tokens.spacing['spacing-sm'],
        bottom: tokens.spacing['spacing-sm'],
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing['spacing-xs'],
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: tokens.radius['rounded-pill'],
        paddingHorizontal: tokens.spacing['spacing-sm'],
        opacity: 0.9,
      }}
    >
      <Text variant="micro" tone="textHelper">
        {t('dev.apiSource')}
      </Text>
      {SOURCES.map((s) => (
        <PillTag key={s.source} label={t(s.label)} selected={source === s.source} onPress={() => setSource(s.source)} />
      ))}
    </View>
  );
}
