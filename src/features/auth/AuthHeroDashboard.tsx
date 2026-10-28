import { View } from 'react-native';
import { Card, Placeholder, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { t } from '@/i18n';

const sp = tokens.spacing;
const c = tokens.color;

/** Composited dashboard glimpse for the auth hero (DESIGN page 1). */
export function AuthHeroDashboard() {
  return (
    <View
      testID="auth-hero-dashboard"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        marginTop: sp['spacing-xl'],
        transform: [{ perspective: 900 }, { rotateY: '-8deg' }, { rotateX: '4deg' }],
        shadowColor: c.primary,
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      }}
    >
      <Card style={{ gap: sp['spacing-md'], padding: sp['spacing-lg'], backgroundColor: c.canvas, opacity: 0.96 }}>
        <Text variant="caption" tone="textSecondary">
          {t('dashboard.title')}
        </Text>
        <Text variant="heading-md">{t('auth.heroPreview.greeting')}</Text>
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
          <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
            <Text variant="micro-cap" tone="textHelper">
              {t('auth.heroPreview.netWorth')}
            </Text>
            <Text variant="heading-sm">{t('auth.heroPreview.netWorthAmount')}</Text>
          </View>
          <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
            <Text variant="micro-cap" tone="textHelper">
              {t('auth.heroPreview.leftToSpend')}
            </Text>
            <Text variant="heading-sm">{t('auth.heroPreview.leftAmount')}</Text>
          </View>
        </View>
        <Placeholder height={72} />
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
          <View style={{ flex: 1 }}>
            <Placeholder height={56} />
          </View>
          <View style={{ flex: 1 }}>
            <Placeholder height={56} />
          </View>
        </View>
      </Card>
    </View>
  );
}
