import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { sizeClassFor } from '@/design/size';
import { RedesignBanner } from './components';
import { RedesignText } from './Text';
import { redesignLight as theme, redesignTokens as tokens } from './theme';

const sp = tokens.space;
const shape = tokens.shape;

/** Mark + wordmark from Auth / Components Logo. */
export function RedesignLogo({ testID = 'redesign-logo' }: { testID?: string }) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md, minHeight: 36 }}>
      <View
        accessibilityElementsHidden
        style={{
          width: 36,
          height: 36,
          borderRadius: shape['radius-sm'],
          backgroundColor: theme.primary,
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexDirection: 'row',
          gap: 3,
          paddingHorizontal: 7,
          paddingBottom: 7,
        }}
      >
        <View style={{ width: 5, height: 10, borderRadius: 2.5, backgroundColor: theme.textOnPrimary }} />
        <View style={{ width: 5, height: 16, borderRadius: 2.5, backgroundColor: theme.textOnPrimary }} />
        <View style={{ width: 5, height: 22, borderRadius: 2.5, backgroundColor: theme.textOnPrimary }} />
      </View>
      <RedesignText variant="wordmark" accessibilityRole="header">
        {t('app.name')}
      </RedesignText>
    </View>
  );
}

function RedesignChromeFrame({
  children,
  testID,
  cardMaxWidth,
  showLogoOnPhone = false,
}: {
  children: ReactNode;
  testID: string;
  cardMaxWidth: number;
  showLogoOnPhone?: boolean;
}) {
  const online = useOnline();
  const { width } = useWindowDimensions();
  const phone = sizeClassFor(width) === 'phone';
  const pagePadX = phone ? sp.xl : width >= 834 ? 48 : sp.xxl;
  const headerPadTop = phone ? tokens.frame.topBarHeadroom + 4 : sp.xxl;
  const card = !phone;
  const showLogo = !phone || showLogoOnPhone;

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: phone ? theme.surface : theme.page }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
          {showLogo ? (
            <View style={{ paddingTop: headerPadTop, paddingHorizontal: pagePadX, paddingBottom: sp.sm }}>
              <RedesignLogo />
            </View>
          ) : (
            <View style={{ height: headerPadTop }} />
          )}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: pagePadX,
              paddingTop: phone && !showLogoOnPhone ? sp.lg : sp.xxl,
              paddingBottom: phone ? sp.xxl : 64,
              alignItems: card ? 'center' : undefined,
            }}
          >
            <View
              style={
                card
                  ? {
                      width: '100%',
                      maxWidth: cardMaxWidth,
                      backgroundColor: theme.surface,
                      borderRadius: shape['radius-lg'],
                      padding: 40,
                      gap: sp.xl,
                      boxShadow: tokens.elevation['2'],
                    }
                  : { width: '100%', gap: sp.xl, flexGrow: 1 }
              }
            >
              {!online ? <RedesignBanner message={t('auth.offline')} testID="auth-offline" /> : null}
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Auth shell matching Auth file Phone (390 full-bleed) and Tablet/Web (canvas + 480 card).
 * Figma: Auth / Mobile 3:278 · Auth / Tablet 4:440 · Auth / Web 5:440
 */
export function RedesignAuthFrame({ children }: { children: ReactNode }) {
  return (
    <RedesignChromeFrame testID="redesign-auth-frame" cardMaxWidth={480} showLogoOnPhone>
      {children}
    </RedesignChromeFrame>
  );
}

/**
 * Welcome / setup shell: Phone full-bleed (no logo); Tablet/Web logo + 560 card.
 * Figma: Welcome / Mobile 4:271 · Tablet 3:271 · Web 2:341
 */
export function RedesignSetupFrame({ children }: { children: ReactNode }) {
  return (
    <RedesignChromeFrame testID="redesign-setup-frame" cardMaxWidth={560}>
      {children}
    </RedesignChromeFrame>
  );
}
