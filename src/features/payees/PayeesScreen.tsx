import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Amount,
  Button,
  Card,
  EmptyState,
  InlineError,
  Placeholder,
  Popover,
  Text,
  TextInput,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { Payee } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ruleFromPayee, payeeMonogram } from '@/features/rules/helpers';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { MergePayeesSheet, type MergeKeepChoices } from './MergePayeesSheet';
import { PayeePanel } from './PayeePanel';
import { aliasOwner, payeeRows, sortPayeeRows, yearOf, type PayeeSort } from './helpers';

const sp = tokens.spacing;
const SORT_OPTIONS: { value: PayeeSort; label: string }[] = [
  { value: 'name', label: t('payees.sortName') },
  { value: 'mostUsed', label: t('payees.sortUsed') },
  { value: 'mostSpent', label: t('payees.sortSpent') },
];

function matches(row: ReturnType<typeof payeeRows>[number], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.payee.name.toLowerCase().includes(q) ||
    row.defaultCategoryName.toLowerCase().includes(q) ||
    (row.payee.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  );
}

function paramId(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v || undefined;
}

export function PayeesScreen() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ payee?: string; merge?: string }>();
  const size = useSizeClass();
  const sidePanel = size === 'desktop' || size === 'wide' || size === 'tablet';
  const year = yearOf(today());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PayeeSort>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!snapshot) return null;
    return sortPayeeRows(
      payeeRows(snapshot, year).filter((r) => matches(r, query)),
      sort,
    );
  }, [snapshot, year, query, sort]);

  // PU00-5 / PU-46: ?payee=<id> — derive selection from the address (no effect sync).
  const selected = useMemo(() => {
    const id = paramId(params.payee);
    if (!id || !snapshot) return null;
    return snapshot.payees.find((p) => p.id === id) ?? null;
  }, [params.payee, snapshot]);

  // PU-47: ?merge=<id>,<id>
  const mergePayees = useMemo(() => {
    const raw = paramId(params.merge);
    if (!raw || !snapshot) return [];
    const ids = raw.split(',').filter(Boolean);
    const list = ids.map((id) => snapshot.payees.find((p) => p.id === id)).filter(Boolean) as Payee[];
    return list.length >= 2 ? list : [];
  }, [params.merge, snapshot]);
  const mergeOpen = mergePayees.length >= 2;

  const openPayee = (payee: Payee) => {
    router.setParams({ payee: payee.id });
  };

  const closePayee = () => {
    router.setParams({ payee: undefined });
  };

  const openMerge = (list?: Payee[]) => {
    const payees = list ?? snapshot?.payees ?? [];
    if (payees.length < 2) return;
    router.setParams({ merge: payees.map((p) => p.id).join(',') });
  };

  const closeMerge = () => {
    router.setParams({ merge: undefined });
  };

  const openCreateRule = async (payee: Payee) => {
    if (!snapshot) return;
    const draft = ruleFromPayee(payee.name, payee.defaultCategoryId);
    const rule = await repo.createRule({ ...draft, order: snapshot.rules.length });
    closePayee();
    router.push(`/rules?edit=${rule.id}`);
  };

  const savePayee = async (p: Payee) => {
    setError(null);
    for (const alias of p.aliases ?? []) {
      const owner = snapshot ? aliasOwner(snapshot, alias, p.id) : undefined;
      if (owner) return { ok: false as const, aliasConflict: owner.name };
    }
    const r = await repo.updatePayee(p);
    if (!r.ok) return { ok: false as const };
    toast.show(t('payees.saved'));
    return { ok: true as const };
  };

  const panel = selected && snapshot ? (
    <PayeePanel
      key={selected.id}
      payee={selected}
      snapshot={snapshot}
      side={sidePanel}
      onClose={closePayee}
      onSave={savePayee}
      onCreateRule={() => void openCreateRule(selected)}
      onMergeWith={() => {
        const others = (snapshot?.payees ?? []).filter((p) => p.id !== selected.id);
        openMerge([selected, ...others]);
      }}
      onDelete={async () => {
        const r = await repo.deletePayee(selected.id);
        if (!r.ok) {
          setError(t('payees.deleteHasTx'));
          return false;
        }
        toast.show(t('payees.deleted'));
        return true;
      }}
    />
  ) : null;

  return (
    <AppFrame title={t('payees.title')}>
      <View style={{ flex: 1, flexDirection: sidePanel ? 'row' : 'column', gap: sp['spacing-md'] }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: sp['spacing-lg'], paddingBottom: sp['spacing-xl'] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <TextInput testID="payees-search" label={t('payees.search')} value={query} onChangeText={setQuery} />
            </View>
            <Button
              testID="payees-merge"
              kind="secondary"
              label={t('payees.merge')}
              onPress={() => openMerge()}
              disabled={!snapshot || snapshot.payees.length < 2}
            />
            <Button testID="payees-sort" kind="secondary" label={t('payees.sort')} onPress={() => setSortOpen(true)} />
          </View>
          {error ? <InlineError message={error} /> : null}
          {!rows ? (
            <Placeholder height={120} />
          ) : rows.length === 0 ? (
            <EmptyState title={t('payees.emptyTitle')} body={t('payees.emptyBody')} actionLabel={t('nav.transactions')} onAction={() => router.push('/transactions')} />
          ) : sidePanel ? (
            <View style={{ gap: sp['spacing-xs'] }}>
              <View style={{ flexDirection: 'row', paddingVertical: sp['spacing-xs'], borderBottomWidth: 1, borderColor: theme.border }}>
                <Text variant="caption" tone="textSecondary" style={{ flex: 2 }}>
                  {t('payees.colName')}
                </Text>
                <Text variant="caption" tone="textSecondary" style={{ flex: 1.2 }}>
                  {t('payees.usualCategory')}
                </Text>
                <Text variant="caption" tone="textSecondary" style={{ width: 72 }}>
                  {t('payees.colTx')}
                </Text>
                <Text variant="caption" tone="textSecondary" style={{ width: 96 }}>
                  {t('payees.spentThisYear')}
                </Text>
                <Text variant="caption" tone="textSecondary" style={{ width: 88 }}>
                  {t('payees.colLast')}
                </Text>
                <Text variant="caption" tone="textSecondary" style={{ width: 48 }}>
                  {t('payees.colRules')}
                </Text>
              </View>
              {rows.map((row) => (
                <PayeeTableRow key={row.payee.id} row={row} active={selected?.id === row.payee.id} onPress={() => openPayee(row.payee)} />
              ))}
            </View>
          ) : (
            rows.map((row) => (
              <Pressable
                key={row.payee.id}
                testID={`payee-row-${row.payee.id}`}
                accessibilityRole="button"
                accessibilityLabel={t('payees.rowLabel', { name: row.payee.name, count: row.txCount })}
                onPress={() => openPayee(row.payee)}
              >
                <Card style={{ flexDirection: 'row', gap: sp['spacing-md'], alignItems: 'center' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: tokens.radius['rounded-md'],
                      backgroundColor: theme.tagFill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <Text variant="caption" style={{ color: theme.tagText }}>
                      {payeeMonogram(row.payee.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
                    <Text variant="heading-sm">{row.payee.name}</Text>
                    <Text tone="textSecondary" variant="caption">
                      {row.defaultCategoryName ? t('payees.defaultCategory', { name: row.defaultCategoryName }) : t('payees.noUsualCategory')}
                    </Text>
                    <Text variant="caption" tone="textSecondary">
                      {t('payees.txCount', { count: row.txCount })}
                    </Text>
                    <Text variant="caption" tone="textSecondary">
                      {row.lastUsed ? t('payees.lastUsed', { date: formatDay(row.lastUsed) }) : t('payees.neverUsed')}
                    </Text>
                  </View>
                  <Amount minor={row.spentThisYear} variant="caption" />
                </Card>
              </Pressable>
            ))
          )}
        </ScrollView>

        {sidePanel ? panel : null}
      </View>

      {!sidePanel ? panel : null}

      {mergeOpen && snapshot && mergePayees.length >= 2 ? (
        <MergePayeesSheet
          snapshot={snapshot}
          payees={mergePayees}
          onClose={closeMerge}
          onMerge={async (keepId, mergeIds, keep: MergeKeepChoices) => {
            setError(null);
            const r = await repo.mergePayees(keepId, mergeIds, {
              nameId: keep.nameId,
              logoId: keep.logoId,
              categoryId: keep.categoryId,
            });
            if (r.ok) {
              toast.show(t('payees.merged'), () => {
                void repo.undoMergePayees(r.value.mergeId).then(() => toast.show(t('common.undo')));
              });
              closeMerge();
              closePayee();
              return;
            }
            setError(ledgerMessage(r.error));
          }}
        />
      ) : null}

      <Popover visible={sortOpen} onClose={() => setSortOpen(false)} testID="payees-sort-popover">
        {SORT_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            kind="link"
            label={opt.label}
            onPress={() => {
              setSort(opt.value);
              setSortOpen(false);
            }}
          />
        ))}
      </Popover>
    </AppFrame>
  );
}

function PayeeTableRow({
  row,
  active,
  onPress,
}: {
  row: ReturnType<typeof payeeRows>[number];
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={`payee-row-${row.payee.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: tokens.spacing['spacing-sm'],
        backgroundColor: active ? theme.hover : undefined,
        borderRadius: tokens.radius['rounded-md'],
      }}
    >
      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: tokens.spacing['spacing-sm'] }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: tokens.radius['rounded-md'],
            backgroundColor: theme.tagFill,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" style={{ color: theme.tagText }}>
            {payeeMonogram(row.payee.name)}
          </Text>
        </View>
        <Text>{row.payee.name}</Text>
      </View>
      <Text tone="textSecondary" variant="caption" style={{ flex: 1.2 }}>
        {row.defaultCategoryName || t('payees.noUsualCategory')}
      </Text>
      <Text variant="caption" style={{ width: 72 }}>
        {row.txCount}
      </Text>
      <View style={{ width: 96 }}>
        <Amount minor={row.spentThisYear} variant="caption" />
      </View>
      <Text variant="caption" tone="textSecondary" style={{ width: 88 }}>
        {row.lastUsed ? formatDay(row.lastUsed) : t('payees.neverUsed')}
      </Text>
      <Text variant="caption" style={{ width: 48 }}>
        {row.rulesCount}
      </Text>
    </Pressable>
  );
}
