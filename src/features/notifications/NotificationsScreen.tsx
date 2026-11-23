import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  Calendar,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { SecurityAlertSheet } from './SecurityAlertSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

import { t } from '../../i18n';
interface NotificationItemUI {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'bill' | 'budget' | 'security' | 'sync';
}

export function NotificationsScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { repo, notifications: dbNotifications } = useDatabaseData();

  const [localNotifications, setLocalNotifications] = useState<NotificationItemUI[]>([
    {
      id: 'n-1',
      title: 'Bill Due Today: Spectranet Internet',
      message: '₦22,000.00 is scheduled for payment today from GTBank.',
      time: '2 hours ago',
      read: false,
      type: 'bill',
    },
    {
      id: 'n-2',
      title: 'Groceries Envelope at 88%',
      message: 'You have spent ₦48,500 of your ₦80,000 envelope limit.',
      time: 'Yesterday',
      read: false,
      type: 'budget',
    },
    {
      id: 'n-3',
      title: 'New Sign-In from Windows Edge',
      message: 'Signed in from Lagos, Nigeria. Review if this was not you.',
      time: '2 days ago',
      read: true,
      type: 'security',
    },
  ]);

  const notifications: NotificationItemUI[] = React.useMemo(() => {
    if (dbNotifications.length > 0) {
      return dbNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.body || '',
        time: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recent',
        read: n.read,
        type: (n.category === 'bills' ? 'bill' : n.category === 'budget' ? 'budget' : 'sync') as
          | 'bill'
          | 'budget'
          | 'security'
          | 'sync',
      }));
    }
    return localNotifications;
  }, [dbNotifications, localNotifications]);

  const [securitySheetVisible, setSecuritySheetVisible] = useState(false);

  const markAllRead = () => {
    if (repo) {
      repo.markAllNotificationsRead().catch((e: unknown) => console.warn('Failed to mark all read in DB', e));
    }
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleAction = (item: NotificationItemUI) => {
    if (item.type === 'bill') {
      router.push('/plan' as any);
    } else if (item.type === 'budget') {
      router.push('/budget' as any);
    } else if (item.type === 'security') {
      setSecuritySheetVisible(true);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            borderBottomColor: colors.borderSubtle,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { padding: spacing.xs }]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[
              styles.screenTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.lg,
              },
            ]}
          >
            {t('ui.notificationsScreen.notifications')}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {t('ui.notificationsScreen.alertsAndActivityUpdates')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={markAllRead}
          style={[
            styles.markReadBtn,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 5,
            },
          ]}
        >
          <Check size={14} color={colors.primary} />
          <Text
            style={{
              color: colors.primary,
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            {t('ui.notificationsScreen.markAllRead')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleAction(item)}
            style={[
              styles.notifCard,
              {
                backgroundColor: item.read ? colors.surface : colors.primaryLight,
                borderColor: item.read ? colors.borderSubtle : colors.primary,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radii.full,
                    marginTop: 2,
                  },
                ]}
              >
                {item.type === 'bill' ? (
                  <Calendar size={18} color={colors.primary} />
                ) : item.type === 'budget' ? (
                  <AlertTriangle size={18} color={colors.statusWarning} />
                ) : (
                  <ShieldAlert size={18} color={colors.statusDanger} />
                )}
              </View>

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.regular,
                    marginTop: 2,
                    lineHeight: 18,
                  }}
                >
                  {item.message}
                </Text>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontSize: 10,
                    fontFamily: typography.fonts.regular,
                    marginTop: 6,
                  }}
                >
                  {item.time}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Security Sheet */}
      <SecurityAlertSheet
        visible={securitySheetVisible}
        onClose={() => setSecuritySheetVisible(false)}
        deviceInfo="Windows Edge / Chrome"
        location="Lagos, Nigeria"
        timestamp="14 Nov 2026, 10:14 PM"
        onSignOutOthers={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {},
  screenTitle: {},
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  notifCard: {
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
