import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnline } from '@/lib/useOnline';
import { useSyncStatus } from '@/data/sync/SyncProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { CommandBar, CommandSearchButton } from '@/features/command/CommandBar';
import { mergeDerivedNotifications, unreadCount } from '@/features/notifications/helpers';
import { setUnreadBadge } from '@/features/notifications/localPush';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { useUnreadDocumentTitle } from '@/features/notifications/useUnreadDocumentTitle';
import { SyncIssuesBanner } from '@/features/sync/SyncIssues';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { today } from '@/features/transactions/helpers';
import { useDesign } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { DesktopFrame } from '@/features/frame/DesktopFrame';
import { t } from '@/i18n';
import {
  RedesignBottomNav,
  RedesignOfflineStrip,
  RedesignTopBar,
} from './components';
import { RedesignIcon } from './icons';
import { RedesignText } from './Text';
import { redesignLight as theme, redesignTokens as tokens } from './theme';
import type { RedesignIconName } from './icons';

const PHONE_TABS: { key: string; labelKey: 'nav.home' | 'nav.transactions' | 'nav.budget' | 'nav.more'; href: string; icon: RedesignIconName }[] = [
  { key: 'home', labelKey: 'nav.home', href: '/', icon: 'home' },
  { key: 'transactions', labelKey: 'nav.transactions', href: '/transactions', icon: 'list' },
  { key: 'budget', labelKey: 'nav.budget', href: '/budget', icon: 'pie' },
  { key: 'more', labelKey: 'nav.more', href: '/more', icon: 'more' },
];

function activeTab(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/transactions')) return 'transactions';
  if (pathname.startsWith('/budget')) return 'budget';
  if (pathname.startsWith('/accounts') || pathname.startsWith('/more')) return 'more';
  return 'more';
}

function PrivacyToggle({ testID = 'privacy-toggle' }: { testID?: string }) {
  const { privacy, setPrivacy } = useDesign();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: privacy }}
      aria-checked={privacy}
      accessibilityLabel={privacy ? t('nav.privacyOff') : t('nav.privacyOn')}
      onPress={() => setPrivacy(!privacy)}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <RedesignIcon name={privacy ? 'eye-off' : 'eye'} size={22} color={theme.text} />
    </Pressable>
  );
}

/** Phone keeps the page as-is. Tablet and desktop add the sidebar. */
export function RedesignShell({ children }: { children: ReactNode }) {
  const size = useSizeClass();
  if (size === 'phone') return <>{children}</>;
  return <DesktopFrame>{children}</DesktopFrame>;
}

/**
 * Secondary stack page (Figma Phone / Investments, Bills, Goals, …).
 * Top bar with Back; no bottom nav. Wide screens keep the app sidebar.
 */
export function RedesignStackFrame({
  title,
  children,
  onBack,
  trailing,
  testID,
}: {
  title: string;
  children: ReactNode;
  onBack: () => void;
  trailing?: ReactNode;
  testID?: string;
}) {
  const online = useOnline();
  const sync = useSyncStatus();
  const offline = !online || sync?.state === 'offline';
  return (
    <RedesignShell>
      <SafeAreaView testID={testID ?? 'redesign-stack-frame'} style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar title={title} onBack={onBack} trailing={trailing} />
        {offline ? <RedesignOfflineStrip /> : null}
        <SyncIssuesBanner />
        <View nativeID="main" style={{ flex: 1, padding: tokens.space.lg }}>
          {children}
        </View>
      </SafeAreaView>
    </RedesignShell>
  );
}

/** Redesign phone app frame: five tabs + floating Add (Figma Mobile App Bottom nav). */
export function RedesignAppFrame({
  title,
  children,
  trailing,
  trailingExtra,
  offlineMessage,
}: {
  title: string;
  children: ReactNode;
  /** Override default Search / Bell / Privacy trailing (page-specific chrome). */
  trailing?: ReactNode;
  /** Optional leading trailing actions (e.g. Accounts plus). */
  trailingExtra?: ReactNode;
  /** Override default offline strip copy (page-specific Figma). */
  offlineMessage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === '/' || pathname === '';
  const online = useOnline();
  const sync = useSyncStatus();
  const { snapshot } = useWorkspace();
  const add = useOptionalAddTransaction();
  const day = today();
  const inbox = useMemo(
    () => (snapshot ? mergeDerivedNotifications(snapshot, snapshot.notifications, day) : []),
    [snapshot, day],
  );
  useUnreadDocumentTitle(inbox);
  useEffect(() => {
    void setUnreadBadge(unreadCount(inbox));
  }, [inbox]);

  const tab = activeTab(pathname);
  const offline = !online || sync?.state === 'offline';

  return (
    <SafeAreaView testID="frame-phone" style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View testID="redesign-frame" style={{ flex: 1 }}>
        <RedesignTopBar
          title={title}
          trailing={
            trailing ?? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {trailingExtra}
                <CommandSearchButton />
                <NotificationsBell items={inbox} />
                <PrivacyToggle testID="redesign-home-privacy-toggle" />
              </View>
            )
          }
        />
        {offline ? <RedesignOfflineStrip message={offlineMessage} /> : null}
        <SyncIssuesBanner />
        <View nativeID="main" style={{ flex: 1, padding: tokens.space.lg }}>
          {children}
        </View>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.surface }}>
          <RedesignBottomNav
            tabs={PHONE_TABS.map((x) => ({ key: x.key, label: t(x.labelKey), icon: x.icon }))}
            activeKey={tab}
            onTab={(key) => {
              const dest = PHONE_TABS.find((x) => x.key === key);
              if (dest) router.push(dest.href as never);
            }}
            onAdd={() => add?.open('expense')}
          />
        </SafeAreaView>
        <CommandBar />
      </View>
    </SafeAreaView>
  );
}

/** More hub — Plan / Wealth / Manage destinations (Figma Phone / More). */
export function RedesignMoreScreen() {
  const router = useRouter();
  const size = useSizeClass();
  const sections: { title: string; items: { label: string; href: string; icon: RedesignIconName; subtitle?: string }[] }[] = [
    {
      title: t('nav.plan'),
      items: [
        { label: t('nav.planBills'), href: '/plan', icon: 'repeat', subtitle: t('redesign.more.billsHint') },
        { label: t('nav.income'), href: '/income', icon: 'trending-up' },
        { label: t('nav.goals'), href: '/goals', icon: 'target' },
        { label: t('nav.debts'), href: '/debts', icon: 'swap' },
      ],
    },
    {
      title: t('nav.wealth'),
      items: [
        { label: t('nav.accounts'), href: '/accounts', icon: 'bank' },
        { label: t('nav.investments'), href: '/investments', icon: 'trending-up' },
        { label: t('nav.reports'), href: '/reports', icon: 'file' },
        { label: t('nav.cashflow'), href: '/cash-flow', icon: 'flow' },
        { label: t('nav.health'), href: '/health', icon: 'pulse' },
      ],
    },
    {
      title: t('nav.manage'),
      items: [
        { label: t('nav.payees'), href: '/payees', icon: 'users' },
        { label: t('nav.rules'), href: '/rules', icon: 'zap' },
        { label: t('nav.settings'), href: '/settings', icon: 'sliders' },
        { label: t('nav.notifications'), href: '/notifications', icon: 'bell' },
      ],
    },
  ];

  const body = (
    <ScrollView
      testID="redesign-more-scroll"
      contentContainerStyle={{ gap: tokens.space.md, paddingBottom: tokens.space.huge * 1.5 }}
      showsVerticalScrollIndicator={false}
    >
      <View testID="redesign-more-screen" style={{ gap: tokens.space.md }}>
        {sections.map((section) => (
          <View key={section.title} style={{ gap: tokens.space.xs }}>
            <RedesignText variant="label" tone="textSecondary" style={{ paddingHorizontal: tokens.space.xs }}>
              {section.title}
            </RedesignText>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: tokens.shape['radius-md'],
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              {section.items.map((item, index) => (
                <Pressable
                  key={item.href}
                  testID={`more-link-${item.href.replace(/\//g, '') || 'home'}`}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  onPress={() => router.push(item.href as never)}
                  style={{
                    minHeight: 46,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.space.sm,
                    paddingHorizontal: tokens.space.md,
                    paddingVertical: 8,
                    borderBottomWidth: index < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: tokens.shape['radius-sm'],
                      backgroundColor: theme.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RedesignIcon name={item.icon} size={18} color={theme.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RedesignText variant="body-medium">{item.label}</RedesignText>
                  </View>
                  <RedesignIcon name="chevron-right" size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <RedesignText variant="helper" tone="textSecondary" style={{ paddingHorizontal: tokens.space.xs, paddingTop: tokens.space.xxs }}>
          {t('redesign.more.pinTip')}
        </RedesignText>
      </View>
    </ScrollView>
  );

  if (size !== 'phone') {
    return (
      <DesktopFrame>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
          <View nativeID="main" style={{ flex: 1, padding: tokens.space.lg }}>
            <RedesignText variant="title" accessibilityRole="header">
              {t('nav.more')}
            </RedesignText>
            {body}
          </View>
        </SafeAreaView>
      </DesktopFrame>
    );
  }

  return <RedesignAppFrame title={t('nav.more')}>{body}</RedesignAppFrame>;
}
