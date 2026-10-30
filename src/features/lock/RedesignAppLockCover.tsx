import { View } from 'react-native';
import { RedesignButton, RedesignIcon, RedesignText } from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';

const sp = tokens.space;
const size = tokens.size;

/**
 * Locked / app-switcher cover (Figma Mobile App Phone / App lock 6:2755 · Components AppLock 30:459).
 */
export function RedesignAppLockCover({
  locked,
  unlockLabel,
  onUnlock,
  onPasscode,
}: {
  locked: boolean;
  unlockLabel: string;
  onUnlock: () => void;
  onPasscode: () => void;
}) {
  return (
    <View
      testID="app-lock-cover"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
          <RedesignIcon name="lock" size={size['icon-xl']} color={theme.primary} />
        </View>
        <View style={{ gap: sp.sm, alignItems: 'center', width: '100%' }}>
          <RedesignText variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
            {t('lock.redesign.title')}
          </RedesignText>
          <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
            {t('lock.redesign.body')}
          </RedesignText>
        </View>
        {locked ? (
          <View style={{ gap: sp.md, width: '100%', marginTop: sp.xxl }}>
            <RedesignButton testID="app-lock-unlock" kind="primary" label={unlockLabel} onPress={onUnlock} fullWidth />
            <View style={{ alignItems: 'center' }}>
              <RedesignButton
                testID="app-lock-passcode"
                kind="link"
                label={t('lock.redesign.passcode')}
                onPress={onPasscode}
                accessibilityRole="link"
              />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
