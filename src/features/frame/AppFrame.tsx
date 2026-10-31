import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Plus } from 'lucide-react-native';
import { Banner, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { CommandBar, CommandSearchButton } from '@/features/command/CommandBar';
import { mergeDerivedNotifications, unreadCount } from '@/features/notifications/helpers';
import { setUnreadBadge } from '@/features/notifications/localPush';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { useUnreadDocumentTitle } from '@/features/notifications/useUnreadDocumentTitle';
import { SyncIssuesBanner } from '@/features/sync/SyncIssues';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { today } from '@/features/transactions/helpers';
import { isRedesignEnabled, RedesignAppFrame } from '@/design/redesign';
import { PHONE_BOTTOM_PAGES } from './navigation';
import { DesktopFrame, ICONS, PrivacyToggle, SidebarList, isActive } from './DesktopFrame';

const c = tokens.color;
const sp = tokens.spacing;

function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const add = useOptionalAddTransaction();
  const items = PHONE_BOTTOM_PAGES.map((item) => {
    const active = isActive(pathname, item);
    const Icon = ICONS[item.icon];
    const label = t(item.phoneLabel ?? item.label);
    return (
      <Pressable
        key={item.key}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        onPress={() => router.push(item.href)}
        style={{
          minWidth: 64,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          gap: sp['spacing-xxs'],
        }}
      >
        <Icon size={18} color={active ? theme.link : theme.textSecondary} />
        <Text variant="micro" tone={active ? 'link' : 'textSecondary'}>
          {label}
        </Text>
      </Pressable>
    );
  });
  const plus = add ? (
    <Pressable
      key="add"
      testID="bottom-add"
      accessibilityRole="button"
      accessibilityLabel={t('nav.add')}
      onPress={() => add.open('expense')}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.primaryFill,
      }}
    >
      <Plus size={22} color={theme.onPrimaryFill} />
    </Pressable>
  ) : null;
  const middle = Math.ceil(items.length / 2);
  return (
    <View
      testID="bottom-bar"
      role="navigation"
      style={{
        height: tokens.frame['bottom-bar'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}
    >
      {[...items.slice(0, middle), plus, ...items.slice(middle)]}
    </View>
  );
}

export function AppFrame({
  title,
  children,
  trailing,
  offlineMessage,
}: {
  title: string;
  children: ReactNode;
  /** Redesign phone only — overrides default top-bar trailing. */
  trailing?: ReactNode;
  /** Redesign phone only — overrides offline strip copy. */
  offlineMessage?: string;
}) {
  const size = useSizeClass();
  const theme = useTheme();
  const online = useOnline();
  const { snapshot } = useWorkspace();
  const [drawer, setDrawer] = useState(false);
  const phone = size === 'phone';
  const redesignPhone = isRedesignEnabled() && phone;
  const day = today();
  const inbox = useMemo(
    () => (snapshot ? mergeDerivedNotifications(snapshot, snapshot.notifications, day) : []),
    [snapshot, day],
  );
  useUnreadDocumentTitle(inbox);
  useEffect(() => {
    void setUnreadBadge(unreadCount(inbox));
  }, [inbox]);
  // Redesign phone chrome only (five tabs + floating Add). Flag default off.
  if (redesignPhone) {
    return (
      <RedesignAppFrame title={title} trailing={trailing} offlineMessage={offlineMessage}>
        {children}
      </RedesignAppFrame>
    );
  }
  // Taps on a system notification are handled by LocalPushBridge (Bills reminders and the inbox).

  const content = (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      {!online ? (
        <View style={{ padding: sp['spacing-md'] }}>
          <Banner testID="offline-banner" message={t('common.offline')} />
        </View>
      ) : null}
      <SyncIssuesBanner />
      <View
        nativeID="main"
        style={{
          flex: 1,
          padding: phone ? sp['spacing-lg'] : sp['spacing-xl'],
        }}
      >
        {phone ? null : (
          <Text variant="display-md" accessibilityRole="header" style={{ marginBottom: sp['spacing-xl'] }}>
            {title}
          </Text>
        )}
        {children}
      </View>
    </View>
  );

  if (!phone) return <DesktopFrame>{content}</DesktopFrame>;

  return (
    <SafeAreaView testID="frame-phone" style={{ flex: 1, backgroundColor: theme.card }} edges={['top']}>
      <View
        style={{
          height: tokens.frame['top-bar'],
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: sp['spacing-sm'],
          borderBottomWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Pressable
          testID="open-drawer"
          accessibilityRole="button"
          accessibilityLabel={t('nav.menu')}
          onPress={() => setDrawer(true)}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Menu size={18} color={theme.textSecondary} />
        </Pressable>
        <Text variant="heading-lg" accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }}>
          {title}
        </Text>
        <CommandSearchButton />
        <NotificationsBell items={inbox} />
        <PrivacyToggle color={theme.textSecondary} />
      </View>
      {content}
      <SafeAreaView
        edges={['bottom']}
        style={{
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderColor: theme.border,
        }}
      >
        <BottomBar />
      </SafeAreaView>
      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View
            testID="drawer"
            style={{
              width: 280,
              backgroundColor: theme.sidebar,
              padding: sp['spacing-md'],
            }}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <SidebarList compact={false} onNavigate={() => setDrawer(false)} />
            </SafeAreaView>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={{ flex: 1, backgroundColor: `${c['brand-dark-900']}73` }}
            onPress={() => setDrawer(false)}
          />
        </View>
      </Modal>
      <CommandBar />
    </SafeAreaView>
  );
}
