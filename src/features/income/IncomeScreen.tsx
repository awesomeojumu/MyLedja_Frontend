import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Clock,
  Briefcase,
  Link2,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme, Button } from '../../design';
import { formatNaira } from '../../money';
import { AddIncomeSheet, type AddedIncomeStream } from './AddIncomeSheet';
import { MatchDepositSheet } from './MatchDepositSheet';

interface IncomeStreamUI {
  id: string;
  name: string;
  expectedMinor: bigint;
  receivedMinor: bigint;
  mode: 'net' | 'gross';
  payDay: number;
  status: 'received' | 'pending';
}

export function IncomeScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // State
  const [streams, setStreams] = useState<IncomeStreamUI[]>([
    {
      id: 'str-1',
      name: 'Primary Tech Salary (Full-time)',
      expectedMinor: 85000000n,
      receivedMinor: 85000000n,
      mode: 'net',
      payDay: 25,
      status: 'received',
    },
    {
      id: 'str-2',
      name: 'Consulting Retainer (Lagos Client)',
      expectedMinor: 15000000n,
      receivedMinor: 0n,
      mode: 'net',
      payDay: 30,
      status: 'pending',
    },
  ]);

  // Sheets
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [matchingStream, setMatchingStream] = useState<IncomeStreamUI | null>(null);

  // Totals
  const expectedTotalMinor = streams.reduce((sum, s) => sum + s.expectedMinor, 0n);
  const receivedTotalMinor = streams.reduce((sum, s) => sum + s.receivedMinor, 0n);
  const pendingTotalMinor = expectedTotalMinor - receivedTotalMinor;

  const handleAddStream = (newStream: AddedIncomeStream) => {
    setStreams((prev) => [
      ...prev,
      {
        ...newStream,
        receivedMinor: 0n,
        status: 'pending',
      },
    ]);
  };

  const handleLinkDeposit = (streamId: string) => {
    setStreams((prev) =>
      prev.map((s) =>
        s.id === streamId
          ? { ...s, receivedMinor: s.expectedMinor, status: 'received' }
          : s
      )
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
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
            Income Planning
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Monthly Cash Inflow Plan
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setAddSheetVisible(true)}
          style={[
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            },
          ]}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            Add Stream
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Expected vs Received Hero */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Total Expected Inflows
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(expectedTotalMinor)}
          </Text>

          {/* Breakdown Row */}
          <View
            style={[
              styles.statRow,
              {
                borderTopColor: colors.borderSubtle,
                marginTop: spacing.md,
                paddingTop: spacing.md,
              },
            ]}
          >
            <View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.regular,
                }}
              >
                Received
              </Text>
              <Text
                style={{
                  color: colors.statusSuccess,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.body,
                  marginTop: 2,
                }}
              >
                {formatNaira(receivedTotalMinor)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fonts.regular,
                }}
              >
                Pending
              </Text>
              <Text
                style={{
                  color: colors.statusWarning,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.body,
                  marginTop: 2,
                }}
              >
                {formatNaira(pendingTotalMinor)}
              </Text>
            </View>
          </View>
        </View>

        {/* Streams List */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Scheduled Income Streams
        </Text>

        {streams.map((stream) => (
          <View
            key={stream.id}
            style={[
              styles.streamCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.streamIcon,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <Briefcase size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {stream.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.regular,
                  }}
                >
                  Expected on {stream.payDay}th • {stream.mode === 'net' ? 'Net Pay' : 'Gross'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {formatNaira(stream.expectedMinor)}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        stream.status === 'received'
                          ? colors.statusSuccessLight
                          : colors.statusWarningLight,
                      borderRadius: radii.full,
                      marginTop: 2,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        stream.status === 'received'
                          ? colors.statusSuccess
                          : colors.statusWarning,
                      fontFamily: typography.fonts.medium,
                      fontSize: 10,
                    }}
                  >
                    {stream.status === 'received' ? 'Received' : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>

            {stream.status === 'pending' && (
              <View
                style={{
                  borderTopColor: colors.borderSubtle,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  marginTop: spacing.md,
                  paddingTop: spacing.sm,
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                }}
              >
                <TouchableOpacity
                  onPress={() => setMatchingStream(stream)}
                  style={[
                    styles.matchBtn,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                    },
                  ]}
                >
                  <Link2 size={12} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      fontFamily: typography.fonts.semiBold,
                      marginLeft: 4,
                    }}
                  >
                    Match Deposit
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Sheets */}
      <AddIncomeSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onSave={handleAddStream}
      />

      {matchingStream && (
        <MatchDepositSheet
          visible={Boolean(matchingStream)}
          onClose={() => setMatchingStream(null)}
          streamName={matchingStream.name}
          expectedMinor={matchingStream.expectedMinor}
          onLinkTransaction={() => {
            handleLinkDeposit(matchingStream.id);
            setMatchingStream(null);
          }}
        />
      )}
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
  },
  statRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streamCard: {
    borderWidth: 1,
  },
  streamIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  matchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
