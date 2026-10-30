import { DevSettings, Linking, View } from 'react-native';
import { RedesignButton, RedesignIcon, RedesignText } from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';

const sp = tokens.space;
const size = tokens.size;

function reloadApp() {
  try {
    if (typeof DevSettings.reload === 'function') DevSettings.reload();
  } catch {
    /* ignore */
  }
}

/**
 * Missing env / broken config (Figma Mobile App Phone / Config error 6:2771 · Components ConfigError 30:475).
 */
export function RedesignConfigErrorScreen({ problems }: { problems: string[] }) {
  return (
    <View
      testID="config-error"
      style={{
        flex: 1,
        backgroundColor: theme.surface,
        paddingHorizontal: sp.xl,
        paddingVertical: sp.xxl,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: 480, gap: sp.xl, alignItems: 'center' }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RedesignIcon name="alert" size={size['icon-xl']} color={theme.primary} />
        </View>
        <View style={{ gap: sp.sm, width: '100%' }}>
          <RedesignText variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
            {t('dev.redesign.configTitle')}
          </RedesignText>
          <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
            {t('dev.redesign.configBody')}
          </RedesignText>
          {problems.length ? (
            <RedesignText variant="caption" tone="textSecondary" style={{ textAlign: 'center' }} testID="config-error-names">
              {t('dev.redesign.configNames', { names: problems.join(', ') })}
            </RedesignText>
          ) : null}
        </View>
        <View style={{ gap: sp.md, width: '100%', marginTop: sp.lg }}>
          <RedesignButton
            testID="config-error-retry"
            kind="primary"
            label={t('dev.redesign.tryAgain')}
            onPress={reloadApp}
            fullWidth
          />
          <View style={{ alignItems: 'center' }}>
            <RedesignButton
              testID="config-error-support"
              kind="link"
              label={t('dev.redesign.support')}
              onPress={() => {
                void Linking.openURL('mailto:support@myledja.com');
              }}
              accessibilityRole="link"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
