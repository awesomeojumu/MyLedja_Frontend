import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  Store,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { useTheme, TextInput } from '../../design';
import { EditPayeeSheet, type PayeeItem } from './EditPayeeSheet';
import { MergePayeeSheet } from './MergePayeeSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

export function PayeesScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();

  // Live Database Hook
  const { repo, payees: dbPayees, categories: dbCategories } = useDatabaseData();

  const [search, setSearch] = useState('');
  const [localPayees, setLocalPayees] = useState<PayeeItem[]>([
    {
      id: 'pay-1',
      name: 'Shoprite Lekki Mall',
      defaultCategory: 'Groceries',
      matchPattern: 'SHOPRITE',
      txCount: 18,
    },
    {
      id: 'pay-2',
      name: 'Uber Nigeria',
      defaultCategory: 'Transport & Fuel',
      matchPattern: 'UBER *TRIP',
      txCount: 24,
    },
    {
      id: 'pay-3',
      name: 'TotalEnergies Victoria Island',
      defaultCategory: 'Transport & Fuel',
      matchPattern: 'TOTALENERGIES',
      txCount: 12,
    },
    {
      id: 'pay-4',
      name: 'Ikeja Electric Prepaid',
      defaultCategory: 'Utilities',
      matchPattern: 'IKEDC',
      txCount: 10,
    },
    {
      id: 'pay-5',
      name: 'Netflix Services',
      defaultCategory: 'Entertainment',
      matchPattern: 'NETFLIX',
      txCount: 8,
    },
  ]);

  const payees: PayeeItem[] = React.useMemo(() => {
    if (dbPayees.length > 0) {
      return dbPayees.map((p) => {
        const cat = dbCategories.find((c) => c.id === p.defaultCategoryId);
        return {
          id: p.id,
          name: p.name,
          defaultCategory: cat?.name || 'General',
          matchPattern: p.aliases?.[0] || p.name,
          txCount: 1,
        };
      });
    }
    return localPayees;
  }, [dbPayees, dbCategories, localPayees]);

  // Sheets
  const [editingPayee, setEditingPayee] = useState<PayeeItem | null>(null);
  const [mergingPayee, setMergingPayee] = useState<PayeeItem | null>(null);

  const filtered = payees.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.defaultCategory && p.defaultCategory.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSavePayee = (updated: { name: string; defaultCategory: string; matchPattern?: string }) => {
    if (!editingPayee) return;
    if (repo) {
      const cat = dbCategories.find((c) => c.name.toLowerCase() === updated.defaultCategory.toLowerCase());
      repo.updatePayee({
        id: editingPayee.id,
        name: updated.name,
        defaultCategoryId: cat?.id,
        aliases: updated.matchPattern ? [updated.matchPattern] : [],
      }).catch((e: unknown) => console.warn('Failed to update payee in DB', e));
    }
    setLocalPayees((prev) =>
      prev.map((p) =>
        p.id === editingPayee.id
          ? {
              ...p,
              name: updated.name,
              defaultCategory: updated.defaultCategory,
              matchPattern: updated.matchPattern,
            }
          : p
      )
    );
  };

  const handleMerge = (targetId: string) => {
    if (!mergingPayee) return;
    if (repo) {
      repo.mergePayees(targetId, [mergingPayee.id]).catch((e: unknown) => console.warn('Failed to merge payees in DB', e));
    }
    setLocalPayees((prev) =>
      prev
        .filter((p) => p.id !== mergingPayee.id)
        .map((p) =>
          p.id === targetId ? { ...p, txCount: p.txCount + mergingPayee.txCount } : p
        )
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
            Payees & Merchants
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {payees.length} Verified Counterparties
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={{ marginBottom: spacing.md }}>
          <TextInput
            placeholder="Search payees or merchants..."
            value={search}
            onChangeText={setSearch}
            leftElement={<Search size={16} color={colors.textTertiary} />}
          />
        </View>

        {filtered.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => setEditingPayee(item)}
            style={[
              styles.payeeCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <Store size={18} color={colors.primary} />
              </View>

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fonts.regular,
                  }}
                >
                  {item.txCount} transactions • Auto: {item.defaultCategory || 'None'}
                </Text>
              </View>

              <ChevronRight size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sheets */}
      {editingPayee && (
        <EditPayeeSheet
          visible={Boolean(editingPayee)}
          onClose={() => setEditingPayee(null)}
          payee={editingPayee}
          onSave={handleSavePayee}
          onMergeRequest={() => {
            setMergingPayee(editingPayee);
          }}
        />
      )}

      {mergingPayee && (
        <MergePayeeSheet
          visible={Boolean(mergingPayee)}
          onClose={() => setMergingPayee(null)}
          sourcePayee={mergingPayee}
          otherPayees={payees.filter((p) => p.id !== mergingPayee.id)}
          onConfirmMerge={handleMerge}
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
  content: {
    paddingBottom: 40,
  },
  payeeCard: {
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
