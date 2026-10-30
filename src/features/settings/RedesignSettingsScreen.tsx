import { Image, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignIcon,
  RedesignListRow,
  RedesignStackFrame,
  RedesignText,
  type RedesignIconName,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t, type TextKey } from '@/i18n';
import type { SettingsTabId } from './shipped';

import {
  REDESIGN_SETTINGS_GROUPS,
  REDESIGN_SETTINGS_TITLE,
  settingsPathSegment,
  settingsTabFromPath,
} from './redesignNav';
import { RedesignSettingsSection } from './RedesignSettingsSections';

const sp = tokens.space;
const shape = tokens.shape;

/**
 * Page 26 Settings redesign (Figma Mobile Phone / Settings 6:2461 + 13 section frames).
 * Behind EXPO_PUBLIC_REDESIGN. All 13 hub rows shown (incl. Advanced).
 */
export function RedesignSettingsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = settingsTabFromPath(params.tab);
  if (tab) return <RedesignSettingsSection tab={tab} />;
  return <RedesignSettingsHub />;
}

function RedesignSettingsHub() {
  const router = useRouter();
  const { user } = useAuth();
  const { snapshot } = useWorkspace();
  const photoUri = snapshot?.settings.profilePhotoUri ?? null;
  const name = user?.name?.trim() || t('settings.redesign.profileFallback');
  const version = Constants.expoConfig?.version ?? '2.0';

  return (
    <RedesignStackFrame
      testID="redesign-settings"
      title={t('settings.title')}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
        <View
          testID="settings-profile"
          style={{
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          }}
        >
          <Pressable
            testID="settings-link-profile"
            accessibilityRole="button"
            onPress={() => router.push('/settings/general')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, minHeight: 68 }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: 48, height: 48 }} accessibilityIgnoresInvertColors />
              ) : (
                <RedesignText variant="label">{name.slice(0, 1).toUpperCase()}</RedesignText>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <RedesignText numberOfLines={1}>{name}</RedesignText>
              {user?.email ? (
                <RedesignText variant="helper" tone="textSecondary" numberOfLines={1}>
                  {user.email}
                </RedesignText>
              ) : null}
            </View>
            <RedesignIcon name="chevron-right" size={tokens.size['icon-md']} color={theme.textSecondary} />
          </Pressable>
        </View>

        {REDESIGN_SETTINGS_GROUPS.map((group) => (
          <View key={group.id} style={{ gap: sp.sm }}>
            <RedesignText variant="helper" tone="textSecondary">
              {t(group.titleKey as TextKey)}
            </RedesignText>
            <View
              testID={`settings-group-${group.id}`}
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                overflow: 'hidden',
                paddingVertical: sp.xs,
              }}
            >
              {group.tabs.map((id) => (
                <RedesignListRow
                  key={id}
                  testID={`settings-link-${id}`}
                  title={t(REDESIGN_SETTINGS_TITLE[id] as TextKey)}
                  icon={iconForTab(id)}
                  onPress={() => router.push(`/settings/${settingsPathSegment(id)}`)}
                />
              ))}
            </View>
          </View>
        ))}

        <RedesignText testID="settings-version" variant="caption" tone="textSecondary" style={{ textAlign: 'center' }}>
          {t('settings.redesign.version', { version })}
        </RedesignText>
      </ScrollView>
    </RedesignStackFrame>
  );
}

function iconForTab(id: SettingsTabId): RedesignIconName {
  switch (id) {
    case 'general':
      return 'sliders';
    case 'budget':
      return 'pie';
    case 'categories':
      return 'list';
    case 'notifications':
      return 'bell';
    case 'security':
      return 'lock';
    case 'devices':
      return 'refresh';
    case 'banks':
      return 'bank';
    case 'importExport':
      return 'file';
    case 'currencies':
      return 'swap';
    case 'workspace':
      return 'users';
    case 'ai':
      return 'zap';
    case 'advanced':
      return 'sliders';
    case 'help':
      return 'info';
    default:
      return 'sliders';
  }
}

export { RedesignSettingsSection };
