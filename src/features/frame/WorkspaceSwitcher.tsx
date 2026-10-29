import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Popover, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';

const c = tokens.color;
const sp = tokens.spacing;

/**
 * PU-04 Workspace switcher. Release 1 has only Personal — shows that workspace
 * (with type + tick) and "Workspace settings" only. Create workspace is hidden
 * until Family or Business workspaces ship.
 */
export function WorkspaceSwitcher({ onNavigate, light }: { onNavigate?: () => void; light?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const name = user?.workspaceName || t('settings.workspace.typePersonal');
  const id = user?.workspaceId ?? 'ws-personal';
  const fg = light ? c['on-primary'] : theme.text;
  const muted = light ? `${c['on-primary']}99` : theme.textSecondary;

  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        testID="workspace-switcher"
        accessibilityRole="button"
        accessibilityLabel={t('nav.workspace', { name })}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={{
          borderRadius: tokens.radius['rounded-md'],
          borderWidth: 1,
          borderColor: light ? c['primary-deep'] : theme.border,
          padding: sp['spacing-sm'],
          flexDirection: 'row',
          alignItems: 'center',
          gap: sp['spacing-sm'],
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" style={{ color: fg }}>
            {name}
          </Text>
          <Text variant="micro" style={{ color: muted }}>
            {t('nav.workspaceType.personal')}
          </Text>
        </View>
        <ChevronDown size={14} color={fg} />
      </Pressable>
      <Popover visible={open} onClose={() => setOpen(false)} testID="workspace-switcher-menu">
        <View accessibilityRole="menu" style={{ minWidth: 220, gap: sp['spacing-xxs'] }}>
          <View
            accessibilityRole="menuitem"
            accessibilityState={{ selected: true }}
            accessibilityLabel={`${name}, ${t('nav.workspaceType.personal')}`}
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: sp['spacing-sm'],
              paddingHorizontal: sp['spacing-sm'],
            }}
          >
            <View style={{ flex: 1 }}>
              <Text>{name}</Text>
              <Text variant="caption" tone="textSecondary">
                {t('nav.workspaceType.personal')}
              </Text>
            </View>
            <View testID="workspace-current-tick" accessibilityLabel={id}>
              <Check size={16} color={theme.link} />
            </View>
          </View>
          <Pressable
            testID="workspace-settings"
            accessibilityRole="menuitem"
            accessibilityLabel={t('nav.workspaceSettings')}
            onPress={() => {
              setOpen(false);
              router.push('/settings/workspace');
              onNavigate?.();
            }}
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: sp['spacing-sm'],
              borderRadius: tokens.radius['rounded-xs'],
              backgroundColor: pressed ? theme.hover : undefined,
            })}
          >
            <Text>{t('nav.workspaceSettings')}</Text>
          </Pressable>
        </View>
      </Popover>
    </View>
  );
}
