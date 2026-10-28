import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, LayoutDashboard, LogOut, Menu } from 'lucide-react-native';
import { Banner, StatusPill, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { useAuth } from '@/features/auth/AuthProvider';
import { SHIPPED_PAGES, type NavItem } from './navigation';

const c = tokens.color;
const sp = tokens.spacing;
const ICONS = { dashboard: LayoutDashboard };
const onSidebarMuted = `${c['on-primary']}B3`;
const onSidebarSection = `${c['on-primary']}99`;

function isActive(pathname: string, item: NavItem) {
  return item.href === '/' ? pathname === '/' : pathname.startsWith(String(item.href));
}

function ConnectionPill() {
  const online = useOnline();
  return <StatusPill label={online ? t('status.synced') : t('status.offline')} kind={online ? 'done' : 'pending'} />;
}

function PrivacyToggle({ color }: { color: string }) {
  const { privacy, setPrivacy } = useDesign();
  const Icon = privacy ? EyeOff : Eye;
  return (
    <Pressable
      testID="privacy-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: privacy }}
      aria-checked={privacy}
      accessibilityLabel={privacy ? t('nav.privacyOff') : t('nav.privacyOn')}
      onPress={() => setPrivacy(!privacy)}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={18} color={color} />
    </Pressable>
  );
}

function SidebarList({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  return (
    <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
      {compact ? null : (
        <View style={{ gap: sp['spacing-md'], marginBottom: sp['spacing-lg'] }}>
          <Text variant="heading-sm" style={{ color: c['on-primary'], fontFamily: 'Inter_400Regular' }}>
            {t('app.name')}
          </Text>
          <View
            testID="workspace-switcher"
            accessibilityLabel={t('nav.workspace', { name: user?.workspaceName ?? '' })}
            style={{ borderRadius: tokens.radius['rounded-md'], borderWidth: 1, borderColor: c['primary-deep'], padding: sp['spacing-sm'] }}
          >
            <Text variant="caption" style={{ color: c['on-primary'] }}>
              {user?.workspaceName ?? ''}
            </Text>
          </View>
        </View>
      )}
      {SHIPPED_PAGES.map((item) => {
        const active = isActive(pathname, item);
        const Icon = ICONS[item.icon];
        return (
          <Pressable
            key={item.key}
            testID={`nav-${item.key}`}
            accessibilityRole="link"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(item.label)}
            onPress={() => {
              router.push(item.href);
              onNavigate?.();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: compact ? 'center' : 'flex-start',
              gap: sp['spacing-md'],
              minHeight: 44,
              paddingHorizontal: sp['spacing-md'],
              borderRadius: tokens.radius['rounded-pill'],
              backgroundColor: active ? c['primary-deep'] : undefined,
            }}
          >
            <Icon size={18} color={active ? c['on-primary'] : onSidebarMuted} />
            {compact ? null : <Text style={{ color: active ? c['on-primary'] : onSidebarMuted }}>{t(item.label)}</Text>}
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <View style={{ gap: sp['spacing-sm'], alignItems: compact ? 'center' : 'stretch' }}>
        <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
          <ConnectionPill />
          <PrivacyToggle color={c['on-primary']} />
        </View>
        <Pressable
          testID="sign-out"
          accessibilityRole="button"
          accessibilityLabel={t('nav.signOut')}
          onPress={async () => {
            await signOut();
            router.replace('/sign-in');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'], minHeight: 44, paddingHorizontal: sp['spacing-md'] }}
        >
          <LogOut size={18} color={onSidebarMuted} />
          {compact ? null : <Text variant="caption" style={{ color: onSidebarSection }}>{t('nav.signOut')}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  return (
    <View testID="bottom-bar" accessibilityRole="tablist" style={{ height: tokens.frame['bottom-bar'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      {SHIPPED_PAGES.map((item) => {
        const active = isActive(pathname, item);
        const Icon = ICONS[item.icon];
        const label = t(item.phoneLabel ?? item.label);
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => router.push(item.href)}
            style={{ minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: sp['spacing-xxs'] }}
          >
            <Icon size={18} color={active ? theme.link : theme.textSecondary} />
            <Text variant="micro" tone={active ? 'link' : 'textSecondary'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AppFrame({ title, children }: { title: string; children: ReactNode }) {
  const size = useSizeClass();
  const theme = useTheme();
  const online = useOnline();
  const [drawer, setDrawer] = useState(false);
  const phone = size === 'phone';
  const navWidth = size === 'tablet' ? tokens.frame.rail : tokens.frame.sidebar;

  const content = (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      {!online ? (
        <View style={{ padding: sp['spacing-md'] }}>
          <Banner testID="offline-banner" message={t('common.offline')} />
        </View>
      ) : null}
      <View nativeID="main" style={{ flex: 1, padding: phone ? sp['spacing-lg'] : sp['spacing-xl'] }}>
        {phone ? null : (
          <Text variant="display-md" accessibilityRole="header" style={{ marginBottom: sp['spacing-xl'] }}>
            {title}
          </Text>
        )}
        {children}
      </View>
    </View>
  );

  if (!phone) {
    return (
      <View testID={`frame-${size === 'tablet' ? 'rail' : 'sidebar'}`} style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: navWidth, backgroundColor: c['brand-dark-900'], padding: sp['spacing-md'] }}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left']}>
            <SidebarList compact={size === 'tablet'} />
          </SafeAreaView>
        </View>
        {content}
      </View>
    );
  }

  return (
    <SafeAreaView testID="frame-phone" style={{ flex: 1, backgroundColor: theme.card }} edges={['top']}>
      <View style={{ height: tokens.frame['top-bar'], flexDirection: 'row', alignItems: 'center', paddingHorizontal: sp['spacing-sm'], borderBottomWidth: 1, borderColor: theme.border }}>
        <Pressable
          testID="open-drawer"
          accessibilityRole="button"
          accessibilityLabel={t('nav.menu')}
          onPress={() => setDrawer(true)}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Menu size={18} color={theme.textSecondary} />
        </Pressable>
        <Text variant="heading-lg" accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }}>
          {title}
        </Text>
        <PrivacyToggle color={theme.textSecondary} />
      </View>
      {content}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.card, borderTopWidth: 1, borderColor: theme.border }}>
        <BottomBar />
      </SafeAreaView>
      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View testID="drawer" style={{ width: 280, backgroundColor: c['brand-dark-900'], padding: sp['spacing-md'] }}>
            <SafeAreaView style={{ flex: 1 }}>
              <SidebarList compact={false} onNavigate={() => setDrawer(false)} />
            </SafeAreaView>
          </View>
          <Pressable accessibilityLabel={t('common.close')} style={{ flex: 1, backgroundColor: `${c['brand-dark-900']}73` }} onPress={() => setDrawer(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
