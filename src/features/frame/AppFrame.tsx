import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, ArrowLeftRight, Bell, CalendarClock, CircleDollarSign, Eye, EyeOff, HandCoins, HeartPulse, LayoutDashboard, LineChart, Menu, PieChart, Plus, Settings, Target, TrendingUp, Users, Wallet, Zap } from 'lucide-react-native';
import { Banner, Button, StatusPill, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { useSyncStatus } from '@/data/sync/SyncProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { CommandBar, CommandSearchButton } from '@/features/command/CommandBar';
import { mergeDerivedNotifications, unreadCount } from '@/features/notifications/helpers';
import { setUnreadBadge } from '@/features/notifications/localPush';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { useUnreadDocumentTitle } from '@/features/notifications/useUnreadDocumentTitle';
import { SyncIssuesBanner } from '@/features/sync/SyncIssues';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { today } from '@/features/transactions/helpers';
import { isRedesignEnabled, RedesignAppFrame } from '@/design/redesign';
import { SHIPPED_PAGES, MANAGE_PAGES, PLAN_PAGES, WEALTH_PAGES, PHONE_BOTTOM_PAGES, type NavItem } from './navigation';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const c = tokens.color;
const sp = tokens.spacing;
const ICONS = {
  dashboard: LayoutDashboard,
  transactions: ArrowLeftRight,
  budget: PieChart,
  accounts: Wallet,
  payees: Users,
  rules: Zap,
  settings: Settings,
  goals: Target,
  plan: CalendarClock,
  income: CircleDollarSign,
  debts: HandCoins,
  notifications: Bell,
  investments: TrendingUp,
  reports: LineChart,
  health: HeartPulse,
  cashflow: Activity,
};
const onSidebarMuted = `${c['on-primary']}B3`;
const onSidebarSection = `${c['on-primary']}99`;

function isActive(pathname: string, item: NavItem) {
  return item.href === '/' ? pathname === '/' : pathname.startsWith(String(item.href));
}

function ConnectionPill() {
  const online = useOnline();
  const sync = useSyncStatus();
  if (!online || sync?.state === 'offline') return <StatusPill label={t('status.offline')} kind="pending" />;
  if (sync && sync.rejected > 0) return <StatusPill label={t('status.rejected', { count: sync.rejected })} kind="problem" />;
  if (sync && sync.waiting > 0) return <StatusPill label={t('status.waiting', { count: sync.waiting })} kind="pending" />;
  return <StatusPill label={t('status.synced')} kind="done" />;
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
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={18} color={color} />
    </Pressable>
  );
}

function SidebarList({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { snapshot } = useWorkspace();
  const photoUri = snapshot?.settings.profilePhotoUri;
  const add = useOptionalAddTransaction();
  return (
    <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
      {add && !compact ? (
        <View style={{ marginBottom: sp['spacing-md'] }}>
          <Button
            testID="sidebar-add"
            label={t('nav.add')}
            onPress={() => {
              add.open('expense');
              onNavigate?.();
            }}
          />
        </View>
      ) : null}
      {add && compact ? (
        <Pressable
          testID="rail-add"
          accessibilityRole="button"
          accessibilityLabel={t('nav.add')}
          onPress={() => add.open('expense')}
          style={{
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={20} color={c['on-primary']} />
        </Pressable>
      ) : null}
      {compact ? null : (
        <View style={{ gap: sp['spacing-md'], marginBottom: sp['spacing-lg'] }}>
          <Text variant="heading-sm" style={{ color: c['on-primary'], fontFamily: 'Inter_400Regular' }}>
            {t('app.name')}
          </Text>
          <View
            testID="sidebar-profile"
            style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'] }}
          >
            <View
              testID="sidebar-profile-photo"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c['primary-deep'],
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: 36, height: 36 }} accessibilityIgnoresInvertColors />
              ) : (
                <Text variant="caption" style={{ color: c['on-primary'] }}>
                  {(user?.name ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <Text variant="caption" style={{ color: c['on-primary'], flexShrink: 1 }}>
              {user?.name ?? ''}
            </Text>
          </View>
          <WorkspaceSwitcher light onNavigate={onNavigate} />
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
      {compact ? null : (
        <Text variant="micro" style={{ color: onSidebarSection, marginTop: sp['spacing-md'], textTransform: 'uppercase' }}>
          {t('nav.manage')}
        </Text>
      )}
      {MANAGE_PAGES.map((item) => {
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
      {compact ? null : (
        <Text variant="micro" style={{ color: onSidebarSection, marginTop: sp['spacing-md'], textTransform: 'uppercase' }}>
          {t('nav.plan')}
        </Text>
      )}
      {PLAN_PAGES.map((item) => {
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
      {compact ? null : (
        <Text variant="micro" style={{ color: onSidebarSection, marginTop: sp['spacing-md'], textTransform: 'uppercase' }}>
          {t('nav.wealth')}
        </Text>
      )}
      {WEALTH_PAGES.map((item) => {
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
      <View
        style={{
          gap: sp['spacing-sm'],
          alignItems: compact ? 'center' : 'stretch',
        }}
      >
        <View
          style={{
            flexDirection: compact ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: sp['spacing-sm'],
          }}
        >
          <ConnectionPill />
          <PrivacyToggle color={c['on-primary']} />
        </View>
      </View>
    </View>
  );
}

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
  const navWidth = size === 'tablet' ? tokens.frame.rail : tokens.frame.sidebar;
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

  if (!phone) {
    return (
      <View testID={`frame-${size === 'tablet' ? 'rail' : 'sidebar'}`} style={{ flex: 1, flexDirection: 'row' }}>
        <View
          style={{
            width: navWidth,
            backgroundColor: c['brand-dark-900'],
            padding: sp['spacing-md'],
          }}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left']}>
            <SidebarList compact={size === 'tablet'} />
          </SafeAreaView>
        </View>
        {content}
        <CommandBar />
      </View>
    );
  }

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
              backgroundColor: c['brand-dark-900'],
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
