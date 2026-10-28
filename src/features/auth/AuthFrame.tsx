import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';

const c = tokens.color;
// The gradient mesh (DESIGN.md 2.10): cream, navy tint and navy across the upper third, with a faint gold stop.
const MESH = [
  `radial-gradient(circle at 15% 0%, ${c.primary}E6 0%, transparent 45%)`,
  `radial-gradient(circle at 60% 5%, ${c['primary-bg-subdued-hover']} 0%, transparent 40%)`,
  `radial-gradient(circle at 90% 0%, ${c['canvas-cream']} 0%, transparent 35%)`,
  `radial-gradient(circle at 40% 25%, ${c.gold}1F 0%, transparent 30%)`,
].join(', ');

export function GradientMeshBackdrop({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View testID="gradient-mesh" style={{ flex: 1, backgroundColor: theme.page, experimental_backgroundImage: MESH }}>
      {children}
    </View>
  );
}

export function AuthFrame({ children, offlineMessage = true }: { children: ReactNode; offlineMessage?: boolean }) {
  const theme = useTheme();
  const size = useSizeClass();
  const online = useOnline();
  const showHero = size === 'desktop' || size === 'wide';
  return (
    <GradientMeshBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {showHero ? (
              <View testID="auth-hero" style={{ flex: 1, backgroundColor: c.primary, experimental_backgroundImage: `linear-gradient(120deg, ${c.primary}, ${c['primary-deep']})`, padding: tokens.spacing['spacing-huge'], justifyContent: 'center', gap: tokens.spacing['spacing-xl'] }}>
                <Text variant="heading-sm" tone="onPrimaryFill" style={{ fontFamily: 'Inter_400Regular', color: c['on-primary'] }}>
                  {t('app.name')}
                </Text>
                <Text variant="display-xl" style={{ color: c['on-primary'], maxWidth: 520 }}>
                  {t('app.brandLine')}
                </Text>
              </View>
            ) : null}
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: size === 'phone' ? tokens.spacing['spacing-lg'] : tokens.spacing['spacing-xl'],
                gap: tokens.spacing['spacing-lg'],
              }}
            >
              {showHero ? null : (
                <Text variant="heading-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                  {t('app.name')}
                </Text>
              )}
              <View
                style={{
                  width: '100%',
                  maxWidth: tokens.width['auth-card'],
                  backgroundColor: theme.card,
                  borderRadius: tokens.radius['rounded-lg'],
                  padding: tokens.spacing['spacing-xl'],
                  gap: tokens.spacing['spacing-lg'],
                  boxShadow: tokens.elevation['elevation-2'],
                }}
              >
                {offlineMessage && !online ? <Banner testID="auth-offline" message={t('auth.offline')} /> : null}
                {children}
              </View>
              <Text variant="caption" tone="textHelper">
                {t('app.byPlanexi')}
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientMeshBackdrop>
  );
}
