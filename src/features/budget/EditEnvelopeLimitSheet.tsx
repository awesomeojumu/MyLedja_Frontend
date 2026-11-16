import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Sliders, Settings, RotateCcw, Check } from 'lucide-react-native';
import { useTheme, BottomSheet, CurrencyInput, Button } from '../../design';
import { formatNaira, toInputText, parseAmount } from '../../money';
import type { CategoryEnvelope } from './CategoryEnvelopeRow';

export interface EditEnvelopeLimitSheetProps {
  visible: boolean;
  onClose: () => void;
  envelope: CategoryEnvelope | null;
  subcategories: string[];
  currentSubBudgets?: Record<string, bigint>;
  onSaveLimit: (
    id: string,
    newTotalLimitMinor: bigint,
    subcategoryLimits: Record<string, bigint>
  ) => void;
}

export function EditEnvelopeLimitSheet({
  visible,
  onClose,
  envelope,
  subcategories,
  currentSubBudgets,
  onSaveLimit,
}: EditEnvelopeLimitSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  const [inputMap, setInputMap] = useState<Record<string, string>>({});
  const [singleLimitText, setSingleLimitText] = useState('');

  // Initialize subcategory inputs when modal opens
  useEffect(() => {
    if (!envelope || !visible) return;

    if (subcategories.length > 0) {
      const map: Record<string, string> = {};
      const totalToDistribute = envelope.plannedMinor;

      subcategories.forEach((sub, idx) => {
        if (currentSubBudgets && currentSubBudgets[sub] !== undefined) {
          map[sub] = toInputText(currentSubBudgets[sub]);
        } else {
          // Provide realistic intelligent initial default distribution
          let shareMinor = 0n;
          if (subcategories.length === 1) {
            shareMinor = totalToDistribute;
          } else if (idx === 0) {
            // First item (e.g. Rent or Groceries) gets a solid primary share
            shareMinor = (totalToDistribute * 50n) / 100n;
          } else {
            const remaining = (totalToDistribute * 50n) / 100n;
            shareMinor = remaining / BigInt(subcategories.length - 1);
          }
          map[sub] = toInputText(shareMinor);
        }
      });
      setInputMap(map);
    } else {
      setSingleLimitText(toInputText(envelope.plannedMinor));
    }
  }, [envelope, visible, subcategories, currentSubBudgets]);

  // Compute live total from all lined-up subcategory inputs
  const totalCalculatedMinor = useMemo(() => {
    if (subcategories.length === 0) {
      const parsed = parseAmount(singleLimitText);
      return parsed.ok ? parsed.minor : 0n;
    }

    return Object.values(inputMap).reduce((sum, str) => {
      const parsed = parseAmount(str);
      return sum + (parsed.ok ? parsed.minor : 0n);
    }, 0n);
  }, [inputMap, singleLimitText, subcategories]);

  if (!envelope) return null;

  // Evenly distribute a target amount across all active subcategories
  const handleDistributeEvenly = () => {
    if (subcategories.length === 0) return;
    const baseShare = totalCalculatedMinor > 0n ? totalCalculatedMinor / BigInt(subcategories.length) : 0n;
    const nextMap: Record<string, string> = {};
    subcategories.forEach((sub) => {
      nextMap[sub] = toInputText(baseShare);
    });
    setInputMap(nextMap);
  };

  const handleSave = () => {
    const subLimits: Record<string, bigint> = {};

    if (subcategories.length > 0) {
      subcategories.forEach((sub) => {
        const str = inputMap[sub] || '0';
        const parsed = parseAmount(str);
        subLimits[sub] = parsed.ok ? parsed.minor : 0n;
      });
    }

    onSaveLimit(envelope.id, totalCalculatedMinor, subLimits);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Edit ${envelope.name} Budget`}
      subtitle={`Configure lined-up subcategories from your Settings`}
    >
      <View style={{ width: '100%' }}>
        {/* Compact Summary Header Card */}
        <View
          style={[
            styles.totalCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              paddingVertical: 8,
              paddingHorizontal: 10,
              marginBottom: 8,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  color: colors.textSecondary,
                  letterSpacing: 0.5,
                  fontFamily: typography.fonts.semiBold,
                }}
              >
                Total {envelope.name} Budget
              </Text>
              <Text
                style={{
                  fontSize: 17,
                  fontFamily: typography.fonts.semiBold,
                  color: colors.primary,
                  marginTop: 1,
                }}
              >
                {formatNaira(totalCalculatedMinor)}
              </Text>
            </View>

            {subcategories.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontFamily: typography.fonts.semiBold, color: colors.primary }}>
                    {subcategories.length} items
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleDistributeEvenly}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 7,
                    paddingVertical: 2.5,
                    borderRadius: radii.full,
                    backgroundColor: colors.surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <RotateCcw size={9} color={colors.textSecondary} style={{ marginRight: 3 }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary, fontFamily: typography.fonts.medium }}>
                    Split Evenly
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Lined up subcategories list */}
        {subcategories.length > 0 ? (
          <View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
                paddingHorizontal: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: typography.fonts.semiBold,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Active Subcategories (from Settings):
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  router.push('/settings');
                }}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Settings size={10} color={colors.primary} style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 10, color: colors.primary, fontFamily: typography.fonts.medium }}>
                  Settings
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 390 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              {subcategories.map((sub) => {
                const currentValStr = inputMap[sub] || '0';
                const parsedVal = parseAmount(currentValStr);
                const subMinor = parsedVal.ok ? parsedVal.minor : 0n;
                const subPct =
                  totalCalculatedMinor > 0n
                    ? Math.round(Number((subMinor * 100n) / totalCalculatedMinor))
                    : 0;

                return (
                  <View
                    key={sub}
                    style={[
                      styles.subRow,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.borderSubtle,
                        borderRadius: radii.sm,
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        marginBottom: 3,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, marginRight: 8, justifyContent: 'center' }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12.5,
                          fontFamily: typography.fonts.semiBold,
                          color: colors.textPrimary,
                        }}
                      >
                        {sub}
                      </Text>
                      <Text style={{ fontSize: 9.5, color: colors.textTertiary, marginTop: 0.5 }}>
                        {subPct}% of {envelope.name}
                      </Text>
                    </View>

                    <View style={{ width: 125 }}>
                      <CurrencyInput
                        compact
                        value={inputMap[sub] || ''}
                        onChangeText={(val) => {
                          setInputMap((prev) => ({ ...prev, [sub]: val }));
                        }}
                        placeholder="0.00"
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={{ marginVertical: spacing.sm }}>
            <CurrencyInput
              value={singleLimitText}
              onChangeText={setSingleLimitText}
              label={`Monthly Planned Amount for ${envelope.name}`}
              placeholder="0.00"
            />
            <Text style={{ fontSize: 10.5, color: colors.textTertiary, marginTop: 4 }}>
              No subcategories enabled for this category in Settings.
            </Text>
          </View>
        )}

        {/* Save Button */}
        <View style={{ marginTop: 8 }}>
          <Button
            label={`Save ${envelope.name} Budget (${formatNaira(totalCalculatedMinor)})`}
            onPress={handleSave}
            variant="primary"
            size="md"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    borderWidth: 1,
  },
  subRow: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
