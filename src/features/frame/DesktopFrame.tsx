import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  CalendarClock,
  CircleDollarSign,
  Eye,
  EyeOff,
  HandCoins,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  PieChart,
  Plus,
  Settings,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { Button, StatusPill, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { t, type TextKey } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { useSyncStatus } from '@/data/sync/SyncProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { CommandBar } from '@/features/command/CommandBar';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { isRedesignEnabled } from '@/design/redesign';
import { RedesignIcon, type RedesignIconName } from '@/design/redesign/icons';
import { SHIPPED_PAGES, MANAGE_PAGES, PLAN_PAGES, WEALTH_PAGES, type NavItem } from './navigation';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const c = tokens.color;
const sp = tokens.spacing;

export const ICONS = {
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

const REDESIGN_ICONS: Record<string, RedesignIconName> = {
  dashboard: 'home',
  transactions: 'list',
  budget: 'pie',
  accounts: 'bank',
  plan: 'repeat',
  income: 'trending-up',
  goals: 'target',
  debts: 'swap',
  investments: 'trending-up',
  reports: 'file',
  cashflow: 'flow',
  health: 'pulse',
  payees: 'users',
  rules: 'zap',
  settings: 'sliders',
  notifications: 'bell',
};

const onSidebarMuted = `${c['on-primary']}B3`;
const onSidebarSection = `${c['on-primary']}99`;

export function isActive(pathname: string, item: NavItem) {
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

export function PrivacyToggle({ color }: { color: string }) {
  const { privacy, setPrivacy } = useDesign();
  const redesign = isRedesignEnabled();
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
      {redesign ? (
        <RedesignIcon name={privacy ? 'eye-off' : 'eye'} size={20} color={color} />
      ) : privacy ? (
        <EyeOff size={18} color={color} />
      ) : (
        <Eye size={18} color={color} />
      )}
    </Pressable>
  );
}

export function SidebarList({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { snapshot } = useWorkspace();
  const photoUri = snapshot?.settings.profilePhotoUri;
  const add = useOptionalAddTransaction();
  const redesign = isRedesignEnabled();
  const fontFam = redesign ? 'Figtree' : undefined;

  const renderNavItem = (item: NavItem) => {
    const active = isActive(pathname, item);
    const Icon = ICONS[item.icon];
    const rIcon = REDESIGN_ICONS[item.icon] ?? 'home';
    const activeBg = redesign ? 'rgba(255, 255, 255, 0.12)' : c['primary-deep'];
    const activeFg = '#FFFFFF';
    const inactiveFg = redesign ? 'rgba(246, 249, 254, 0.70)' : onSidebarMuted;

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
          gap: redesign ? 10 : sp['spacing-md'],
          minHeight: redesign ? 40 : 44,
          paddingHorizontal: compact ? 0 : redesign ? 12 : sp['spacing-md'],
          borderRadius: redesign ? 10 : tokens.radius['rounded-pill'],
          backgroundColor: active ? activeBg : undefined,
        }}
      >
        {redesign ? (
          <RedesignIcon name={rIcon} size={18} color={active ? activeFg : inactiveFg} />
        ) : (
          <Icon size={18} color={active ? c['on-primary'] : onSidebarMuted} />
        )}
        {compact ? null : (
          <Text
            style={{
              color: active ? activeFg : inactiveFg,
              fontFamily: fontFam,
              fontSize: redesign ? 14 : undefined,
              fontWeight: active ? '500' : '400',
            }}
          >
            {t(item.label)}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderSectionHeader = (titleKey: TextKey) => {
    if (compact) return null;
    return (
      <Text
        variant="micro"
        style={{
          color: redesign ? 'rgba(246, 249, 254, 0.45)' : onSidebarSection,
          marginTop: redesign ? sp['spacing-sm'] : sp['spacing-md'],
          marginBottom: redesign ? 2 : 0,
          paddingHorizontal: redesign ? 12 : 0,
          textTransform: 'uppercase',
          letterSpacing: redesign ? 0.8 : undefined,
          fontFamily: fontFam,
          fontSize: redesign ? 11 : undefined,
          fontWeight: redesign ? '600' : undefined,
        }}
      >
        {t(titleKey)}
      </Text>
    );
  };

  return (
    <View style={{ flex: 1, gap: redesign ? 4 : sp['spacing-xs'] }}>
      {/* Brand Header & Workspace Switcher (DESIGN.md 3.2: MyLedja at top, then Workspace, then Add) */}
      {compact ? (
        <View style={{ alignItems: 'center', marginBottom: sp['spacing-sm'] }}>
          <Text
            variant="heading-sm"
            style={{
              color: c['on-primary'],
              fontFamily: fontFam ?? 'Inter_400Regular',
              fontWeight: '700',
            }}
          >
            {t('app.name').slice(0, 1)}
          </Text>
        </View>
      ) : (
        <View style={{ gap: redesign ? sp['spacing-sm'] : sp['spacing-md'], marginBottom: sp['spacing-sm'] }}>
          {/* App Wordmark */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: redesign ? 4 : 0 }}>
            <Text
              variant="heading-sm"
              style={{
                color: '#FFFFFF',
                fontFamily: fontFam ?? 'Inter_400Regular',
                fontWeight: redesign ? '600' : undefined,
                fontSize: redesign ? 18 : undefined,
                letterSpacing: redesign ? -0.2 : undefined,
              }}
            >
              {t('app.name')}
            </Text>
          </View>

          {/* User Profile */}
          <View
            testID="sidebar-profile"
            style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], paddingHorizontal: redesign ? 4 : 0 }}
          >
            <View
              testID="sidebar-profile-photo"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c['primary-deep'],
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: 32, height: 32 }} accessibilityIgnoresInvertColors />
              ) : (
                <Text variant="caption" style={{ color: c['on-primary'], fontFamily: fontFam, fontWeight: '500' }}>
                  {(user?.name ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <Text
              variant="caption"
              style={{
                color: '#FFFFFF',
                flexShrink: 1,
                fontFamily: fontFam,
                fontWeight: '500',
              }}
            >
              {user?.name ?? ''}
            </Text>
          </View>

          {/* Workspace Switcher */}
          <WorkspaceSwitcher light onNavigate={onNavigate} />
        </View>
      )}

      {/* Global Add Button (DESIGN.md 3.2: sits under workspace switcher) */}
      {add && !compact ? (
        <View style={{ marginBottom: redesign ? sp['spacing-sm'] : sp['spacing-md'] }}>
          {redesign ? (
            <Pressable
              testID="sidebar-add"
              accessibilityRole="button"
              accessibilityLabel={t('nav.add')}
              onPress={() => {
                add.open('expense');
                onNavigate?.();
              }}
              style={{
                minHeight: 40,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 16,
              }}
            >
              <RedesignIcon name="plus" size={16} color="#0B2A5B" />
              <Text
                style={{
                  color: '#0B2A5B',
                  fontFamily: 'Figtree',
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                {t('nav.add')}
              </Text>
            </Pressable>
          ) : (
            <Button
              testID="sidebar-add"
              label={t('nav.add')}
              onPress={() => {
                add.open('expense');
                onNavigate?.();
              }}
            />
          )}
        </View>
      ) : null}

      {add && compact ? (
        <Pressable
          testID="rail-add"
          accessibilityRole="button"
          accessibilityLabel={t('nav.add')}
          onPress={() => add.open('expense')}
          style={{
            minHeight: 40,
            width: 40,
            borderRadius: 20,
            backgroundColor: redesign ? '#FFFFFF' : undefined,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginBottom: sp['spacing-sm'],
          }}
        >
          {redesign ? (
            <RedesignIcon name="plus" size={18} color="#0B2A5B" />
          ) : (
            <Plus size={20} color={c['on-primary']} />
          )}
        </Pressable>
      ) : null}

      {/* Everyday Shipped Pages */}
      {SHIPPED_PAGES.map(renderNavItem)}

      {/* Plan Section */}
      {renderSectionHeader('nav.plan')}
      {PLAN_PAGES.map(renderNavItem)}

      {/* Wealth Section */}
      {renderSectionHeader('nav.wealth')}
      {WEALTH_PAGES.map(renderNavItem)}

      {/* Manage Section */}
      {renderSectionHeader('nav.manage')}
      {MANAGE_PAGES.map(renderNavItem)}

      <View style={{ flex: 1 }} />

      {/* Footer Status and Privacy */}
      <View
        style={{
          gap: sp['spacing-sm'],
          alignItems: compact ? 'center' : 'stretch',
          paddingTop: sp['spacing-sm'],
          borderTopWidth: 1,
          borderTopColor: redesign ? 'rgba(255, 255, 255, 0.08)' : undefined,
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

/** Tablet and desktop sidebar. Phone keeps its own frame. */
export function DesktopFrame({ children }: { children: ReactNode }) {
  const size = useSizeClass();
  const theme = useTheme();
  const redesign = isRedesignEnabled();
  const navWidth = size === 'tablet' ? tokens.frame.rail : tokens.frame.sidebar;
  const sidebarBg = redesign ? '#071326' : theme.sidebar;

  return (
    <View testID={`frame-${size === 'tablet' ? 'rail' : 'sidebar'}`} style={{ flex: 1, flexDirection: 'row' }}>
      <View
        style={{
          width: navWidth,
          backgroundColor: sidebarBg,
          padding: sp['spacing-md'],
          borderRightWidth: redesign ? 1 : 0,
          borderRightColor: redesign ? 'rgba(255, 255, 255, 0.08)' : undefined,
        }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left']}>
          <SidebarList compact={size === 'tablet'} />
        </SafeAreaView>
      </View>
      {children}
      <CommandBar />
    </View>
  );
}
