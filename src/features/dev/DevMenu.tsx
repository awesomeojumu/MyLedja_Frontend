import { Platform, View } from 'react-native';
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

/** True under Playwright / automated browsers — the floating menu must not steal Welcome Continue taps. */
function isAutomatedBrowser() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
}

/** Development builds only: switch the API between the mock adapter, a local backend and staging. */
export function DevMenu() {
  const theme = useTheme();
  const { source, setSource } = useAuth();
  // Hide in e2e: absolute bottom-right overlay intercepts Continue on Welcome (desktop + phone).
  if (isAutomatedBrowser()) return null;
  return (
    <View
      testID="dev-menu"
      accessibilityLabel={t('dev.menuTitle')}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: tokens.spacing['spacing-sm'],
        bottom: tokens.spacing['spacing-sm'],
        zIndex: 0,
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
